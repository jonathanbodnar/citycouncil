import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

// Twilio credentials
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
// OTP codes use dedicated number (+19863335069), fallback to user number, then talent number
const OTP_SMS_PHONE_NUMBER = Deno.env.get("OTP_SMS_PHONE_NUMBER") || Deno.env.get("USER_SMS_PHONE_NUMBER") || Deno.env.get("TWILIO_PHONE_NUMBER");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generate a 6-digit OTP code
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Format phone to E.164
function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  return phone.startsWith('+') ? phone : `+${digits}`;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate Twilio credentials
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !OTP_SMS_PHONE_NUMBER) {
      throw new Error("Twilio credentials not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { phone, email, checkEmailOnly } = await req.json();

    if (!email) {
      throw new Error("Email is required");
    }

    const normalizedEmail = email.toLowerCase().trim();
    
    // ========== CHECK EMAIL ONLY MODE ==========
    // If checkEmailOnly is true, we're just checking if user has a phone on file
    // If they do, send OTP to that phone. If not, tell frontend to ask for phone.
    if (checkEmailOnly) {
      console.log('Check email only mode for:', normalizedEmail);
      
      const { data: userByEmail, error: userLookupError } = await supabase
        .from('users')
        .select('id, email, phone, full_name')
        .eq('email', normalizedEmail)
        .single();
      
      console.log('User lookup result:', { 
        found: !!userByEmail, 
        hasPhone: !!userByEmail?.phone,
        phone: userByEmail?.phone,
        error: userLookupError?.message 
      });
      
      if (userByEmail?.phone) {
        // Always format phone to E.164 for consistency
        const formattedPhone = formatPhone(userByEmail.phone);
        console.log('User found with phone:', userByEmail.phone, '-> formatted:', formattedPhone);
        
        // Check rate limiting - only for UNVERIFIED OTPs (allow resend if previous was used)
        const { data: recentOtp } = await supabase
          .from('phone_otp_codes')
          .select('created_at, verified')
          .eq('phone', formattedPhone)
          .eq('verified', false)
          .gte('created_at', new Date(Date.now() - 60000).toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        console.log('Rate limit check:', { recentUnverifiedOtp: !!recentOtp });

        if (recentOtp) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "Please wait 60 seconds before requesting another code.",
              rateLimited: true,
              phoneHint: `***-***-${formattedPhone.slice(-4)}`,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 429 }
          );
        }
        
        // Generate and store OTP with formatted phone
        // NOTE: Don't include user_id - the FK references auth.users, but user may only exist in public.users
        const otpCode = generateOTP();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
        
        console.log('Creating new OTP:', { phone: formattedPhone, code: otpCode, expiresAt: expiresAt.toISOString() });
        
        const { error: insertError } = await supabase.from('phone_otp_codes').insert({
          phone: formattedPhone,
          code: otpCode,
          expires_at: expiresAt.toISOString(),
        });
        
        if (insertError) {
          console.error('Failed to insert OTP:', insertError);
          throw new Error('Failed to create verification code');
        }
        
        console.log('OTP created successfully');
        
        // Send SMS
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
        const authHeader = `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`;
        
        await fetch(twilioUrl, {
          method: "POST",
          headers: {
            "Authorization": authHeader,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            To: formattedPhone,
            From: OTP_SMS_PHONE_NUMBER,
            Body: `Your ShoutOut login code is: ${otpCode}\n\nThis code expires in 5 minutes.`,
          }),
        });
        
        console.log('OTP sent to existing user phone:', formattedPhone);
        
        return new Response(
          JSON.stringify({
            success: true,
            sentToExistingPhone: true,
            phoneHint: `***-***-${formattedPhone.slice(-4)}`,
            phone: formattedPhone,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }
      
      // User doesn't have phone - tell frontend to ask for phone
      // DON'T create a new user here - wait until we have phone to potentially
      // link to existing user from giveaway who has phone but no email
      console.log('User not found or no phone, needs phone input');
      
      return new Response(
        JSON.stringify({
          success: true,
          needsPhone: true,
          sentToExistingPhone: false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // ========== NORMAL MODE: Phone + Email provided ==========
    if (!phone) {
      throw new Error("Phone number is required");
    }

    const formattedPhone = formatPhone(phone);
    console.log('Processing OTP request for phone:', formattedPhone, 'email:', normalizedEmail);

    // Smart user lookup
    let existingUser: any = null;
    let isExistingUser = false;
    let needsPhoneUpdate = false;
    let needsEmailUpdate = false;

    const { data: userByEmail } = await supabase
      .from('users')
      .select('id, email, phone, full_name')
      .eq('email', normalizedEmail)
      .single();

    const { data: userByPhone } = await supabase
      .from('users')
      .select('id, email, phone, full_name')
      .eq('phone', formattedPhone)
      .single();

    console.log('Lookup results:', { 
      userByEmail: userByEmail ? { id: userByEmail.id, hasPhone: !!userByEmail.phone } : null,
      userByPhone: userByPhone ? { id: userByPhone.id, hasEmail: !!userByPhone.email } : null
    });

    if (userByEmail && userByPhone) {
      if (userByEmail.id === userByPhone.id) {
        // Same user has both email and phone - perfect
        existingUser = userByEmail;
        isExistingUser = true;
      } else {
        // Different users - PREFER the EMAIL user (has UTM from giveaway)
        // Giveaway captures email first with UTM, then adds phone
        console.log('Two different users found - preferring email user (has UTM from giveaway)');
        existingUser = userByEmail;
        isExistingUser = true;
        needsPhoneUpdate = true;
        
        // Delete the phone-only user to avoid duplicates
        // Only if phone user has no email (it's just a placeholder)
        if (!userByPhone.email) {
          console.log('Deleting phone-only placeholder user:', userByPhone.id);
          supabase.from('users').delete().eq('id', userByPhone.id).then(() => {
            console.log('Placeholder user deleted');
          }).catch(() => {
            console.log('Could not delete placeholder user');
          });
        }
      }
    } else if (userByEmail) {
      existingUser = userByEmail;
      isExistingUser = true;
      if (!userByEmail.phone || userByEmail.phone !== formattedPhone) {
        needsPhoneUpdate = true;
      }
    } else if (userByPhone) {
      existingUser = userByPhone;
      isExistingUser = true;
      if (!userByPhone.email || userByPhone.email !== normalizedEmail) {
        needsEmailUpdate = true;
      }
    }

    // Update user data if needed
    if (existingUser && (needsPhoneUpdate || needsEmailUpdate)) {
      const updates: any = {};
      if (needsPhoneUpdate) updates.phone = formattedPhone;
      if (needsEmailUpdate) updates.email = normalizedEmail;
      
      await supabase.from('users').update(updates).eq('id', existingUser.id);
      console.log('User data synced:', updates);
    }

    // Rate limiting
    const { data: recentOtp } = await supabase
      .from('phone_otp_codes')
      .select('created_at')
      .eq('phone', formattedPhone)
      .gte('created_at', new Date(Date.now() - 60000).toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (recentOtp) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Please wait 60 seconds before requesting another code.",
          rateLimited: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 429 }
      );
    }

    // Generate and store OTP
    // NOTE: Don't include user_id - the FK references auth.users, but user may only exist in public.users
    const otpCode = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await supabase.from('phone_otp_codes').insert({
      phone: formattedPhone,
      code: otpCode,
      expires_at: expiresAt.toISOString(),
    });

    // Send SMS
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const authHeader = `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`;

    const message = isExistingUser
      ? `Your ShoutOut login code is: ${otpCode}\n\nThis code expires in 5 minutes.`
      : `Your ShoutOut verification code is: ${otpCode}\n\nThis code expires in 5 minutes.`;

    const twilioResponse = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": authHeader,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: formattedPhone,
        From: OTP_SMS_PHONE_NUMBER,
        Body: message,
      }),
    });

    if (!twilioResponse.ok) {
      const errorData = await twilioResponse.json();
      console.error('Twilio API error:', errorData);
      throw new Error(`Failed to send verification code`);
    }

    console.log('OTP sent successfully, isExistingUser:', isExistingUser);

    return new Response(
      JSON.stringify({
        success: true,
        message: isExistingUser ? "Welcome back! Login code sent." : "Verification code sent!",
        phoneHint: `***-***-${formattedPhone.slice(-4)}`,
        isExistingUser,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    console.error("Error sending OTP:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Failed to send verification code",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

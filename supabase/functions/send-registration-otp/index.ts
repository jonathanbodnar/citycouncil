import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

// Twilio credentials
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const USER_SMS_PHONE_NUMBER = Deno.env.get("USER_SMS_PHONE_NUMBER") || Deno.env.get("TWILIO_PHONE_NUMBER");

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
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !USER_SMS_PHONE_NUMBER) {
      throw new Error("Twilio credentials not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { phone, email } = await req.json();

    if (!phone) {
      throw new Error("Phone number is required");
    }

    if (!email) {
      throw new Error("Email is required");
    }

    const formattedPhone = formatPhone(phone);
    const normalizedEmail = email.toLowerCase().trim();
    console.log('Processing OTP request for phone:', formattedPhone, 'email:', normalizedEmail);

    // ========== SMART USER LOOKUP & SYNC ==========
    // Look for existing user by BOTH phone AND email separately
    // This handles all cases:
    // 1. User exists with both matching - simple login
    // 2. User exists with email only (no phone) - add phone, login
    // 3. User exists with phone only (no email) - this shouldn't happen but handle it
    // 4. User exists with email but DIFFERENT phone - update phone, login
    // 5. Different users for email vs phone - use email as primary (more reliable)
    // 6. No user exists - new registration

    let existingUser: any = null;
    let isExistingUser = false;
    let needsPhoneUpdate = false;
    let needsEmailUpdate = false;

    // Check by email first (email is more reliable identifier)
    const { data: userByEmail } = await supabase
      .from('users')
      .select('id, email, phone, full_name')
      .eq('email', normalizedEmail)
      .single();

    // Check by phone
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
      // Both email and phone found
      if (userByEmail.id === userByPhone.id) {
        // Same user - perfect match, just login
        existingUser = userByEmail;
        isExistingUser = true;
        console.log('Perfect match - same user for email and phone');
      } else {
        // Different users! This is tricky - use email user as primary
        // and update their phone (user may have changed phones)
        existingUser = userByEmail;
        isExistingUser = true;
        needsPhoneUpdate = true;
        console.log('Different users for email/phone - using email user, will update phone');
      }
    } else if (userByEmail) {
      // User found by email only
      existingUser = userByEmail;
      isExistingUser = true;
      if (!userByEmail.phone || userByEmail.phone !== formattedPhone) {
        needsPhoneUpdate = true;
        console.log('User found by email, will update/add phone');
      }
    } else if (userByPhone) {
      // User found by phone only (rare - usually email is set)
      existingUser = userByPhone;
      isExistingUser = true;
      if (!userByPhone.email || userByPhone.email !== normalizedEmail) {
        needsEmailUpdate = true;
        console.log('User found by phone, will update/add email');
      }
    } else {
      // No existing user - new registration
      console.log('No existing user found - will be new registration');
    }

    // Update user data if needed (sync phone/email)
    if (existingUser && (needsPhoneUpdate || needsEmailUpdate)) {
      const updates: any = {};
      if (needsPhoneUpdate) updates.phone = formattedPhone;
      if (needsEmailUpdate) updates.email = normalizedEmail;
      
      console.log('Updating user', existingUser.id, 'with:', updates);
      
      const { error: updateError } = await supabase
        .from('users')
        .update(updates)
        .eq('id', existingUser.id);
      
      if (updateError) {
        console.error('Error updating user:', updateError);
        // Don't fail - continue with login/registration
      } else {
        console.log('User data synced successfully');
      }
    }

    // ========== RATE LIMITING ==========
    const { data: recentOtp } = await supabase
      .from('phone_otp_codes')
      .select('created_at')
      .eq('phone', formattedPhone)
      .gte('created_at', new Date(Date.now() - 60000).toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (recentOtp) {
      console.log('Rate limited - recent OTP exists');
      return new Response(
        JSON.stringify({
          success: false,
          error: "Please wait 60 seconds before requesting another code.",
          rateLimited: true,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 429,
        }
      );
    }

    // ========== GENERATE & STORE OTP ==========
    const otpCode = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    const { error: insertError } = await supabase
      .from('phone_otp_codes')
      .insert({
        phone: formattedPhone,
        code: otpCode,
        user_id: isExistingUser ? existingUser.id : null,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error('Error storing OTP:', insertError);
      throw new Error("Failed to generate verification code");
    }

    // ========== SEND SMS ==========
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
        From: USER_SMS_PHONE_NUMBER,
        Body: message,
      }),
    });

    if (!twilioResponse.ok) {
      const errorData = await twilioResponse.json();
      console.error('Twilio API error:', errorData);
      throw new Error(`Failed to send verification code`);
    }

    const twilioData = await twilioResponse.json();
    console.log('OTP SMS sent successfully:', twilioData.sid, {
      isExistingUser,
      needsPhoneUpdate,
      needsEmailUpdate
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: isExistingUser ? "Welcome back! Login code sent." : "Verification code sent!",
        phoneHint: `***-***-${formattedPhone.slice(-4)}`,
        isExistingUser,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error sending OTP:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Failed to send verification code",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

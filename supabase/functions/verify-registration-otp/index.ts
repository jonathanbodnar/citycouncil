import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

// Generate a random password for the user (they'll use phone OTP to login)
function generateRandomPassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 32; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { phone, code, email, promoSource } = await req.json();

    if (!phone || !code || !email) {
      throw new Error("Phone number, code, and email are required");
    }

    const formattedPhone = formatPhone(phone);
    console.log('Verifying registration OTP for phone:', formattedPhone);

    // Find the OTP code (for registration, user_id will be null)
    const { data: otpData, error: otpError } = await supabase
      .from('phone_otp_codes')
      .select('*')
      .eq('phone', formattedPhone)
      .is('user_id', null) // Registration OTPs have no user_id
      .eq('verified', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (otpError || !otpData) {
      console.log('No valid OTP found for phone:', formattedPhone);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid or expired code. Please request a new one.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Check max attempts (5 attempts allowed)
    if (otpData.attempts >= 5) {
      console.log('Max attempts exceeded for OTP:', otpData.id);
      await supabase
        .from('phone_otp_codes')
        .update({ verified: true })
        .eq('id', otpData.id);

      return new Response(
        JSON.stringify({
          success: false,
          error: "Too many failed attempts. Please request a new code.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Increment attempts
    await supabase
      .from('phone_otp_codes')
      .update({ attempts: otpData.attempts + 1 })
      .eq('id', otpData.id);

    // Verify the code
    if (otpData.code !== code.trim()) {
      console.log('Invalid code entered');
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid code. Please try again.",
          attemptsRemaining: 4 - otpData.attempts,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Code is valid! Mark as verified
    await supabase
      .from('phone_otp_codes')
      .update({ verified: true })
      .eq('id', otpData.id);

    console.log('Registration OTP verified successfully');

    // Create the user account with a random password (they'll use phone OTP to login)
    const randomPassword = generateRandomPassword();
    
    // Use email prefix as display name (before @)
    const displayName = email.split('@')[0];

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email.toLowerCase(),
      password: randomPassword,
      email_confirm: true, // Skip email confirmation since we verified phone
      user_metadata: {
        full_name: displayName,
        phone: formattedPhone,
        user_type: 'user',
        promo_source: promoSource || null,
      },
    });

    if (authError) {
      console.error('Error creating user:', authError);
      throw new Error(authError.message || "Failed to create account");
    }

    console.log('User created:', authData.user.id);

    // Wait a moment for the trigger to create the users table entry
    await new Promise(resolve => setTimeout(resolve, 500));

    // Update the users table with phone number (trigger may not set it)
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        phone: formattedPhone,
        promo_source: promoSource || null,
      })
      .eq('id', authData.user.id);

    if (updateError) {
      console.error('Error updating user phone:', updateError);
      // Don't fail - user is created, phone can be updated later
    }

    // Create user_settings entry
    await supabase
      .from('user_settings')
      .upsert([{ user_id: authData.user.id }], {
        onConflict: 'user_id',
        ignoreDuplicates: true
      });

    // Generate a magic link to log them in
    const { data: magicLinkData, error: magicLinkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: email.toLowerCase(),
      options: {
        redirectTo: '/',
      },
    });

    if (magicLinkError) {
      console.error('Error generating magic link:', magicLinkError);
      throw new Error("Account created but login failed. Please use login page.");
    }

    const magicLinkUrl = magicLinkData.properties?.action_link;
    if (!magicLinkUrl) {
      throw new Error("Account created but login failed. Please use login page.");
    }

    console.log('Registration complete, magic link generated for:', email);

    return new Response(
      JSON.stringify({
        success: true,
        magicLink: magicLinkUrl,
        user: {
          id: authData.user.id,
          email: email.toLowerCase(),
          fullName: displayName,
          userType: 'user',
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error verifying registration OTP:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Failed to verify code",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});


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
    console.log('Verifying OTP for phone:', formattedPhone);

    // Find the OTP code (can be for login OR registration)
    const { data: otpData, error: otpError } = await supabase
      .from('phone_otp_codes')
      .select('*')
      .eq('phone', formattedPhone)
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

    console.log('OTP verified successfully');

    // Check if this is LOGIN (user_id exists) or REGISTRATION (user_id is null)
    const isLogin = !!otpData.user_id;

    if (isLogin) {
      // ========== LOGIN FLOW ==========
      console.log('Processing as LOGIN for user:', otpData.user_id);

      // Get user data
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, email, full_name, user_type')
        .eq('id', otpData.user_id)
        .single();

      if (userError || !userData) {
        throw new Error("User not found");
      }

      // Generate a magic link token for this user
      const { data: authData, error: authError } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: userData.email,
        options: {
          redirectTo: userData.user_type === 'talent' ? '/dashboard' : '/',
        },
      });

      if (authError) {
        console.error('Error generating magic link:', authError);
        throw new Error("Failed to authenticate user");
      }

      const magicLinkUrl = authData.properties?.action_link;
      if (!magicLinkUrl) {
        throw new Error("Failed to generate authentication link");
      }

      // Update last_login
      await supabase
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', userData.id);

      console.log('Login successful for:', userData.email);

      return new Response(
        JSON.stringify({
          success: true,
          isLogin: true,
          magicLink: magicLinkUrl,
          user: {
            id: userData.id,
            email: userData.email,
            fullName: userData.full_name,
            userType: userData.user_type,
          },
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    } else {
      // ========== REGISTRATION FLOW ==========
      console.log('Processing as REGISTRATION for email:', email);

      // Double-check user doesn't exist (race condition protection)
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .or(`email.eq.${email.toLowerCase()},phone.eq.${formattedPhone}`)
        .single();

      if (existingUser) {
        // User was created between send and verify - treat as login
        console.log('User created during OTP flow, treating as login');
        
        const { data: userData } = await supabase
          .from('users')
          .select('id, email, full_name, user_type')
          .eq('id', existingUser.id)
          .single();

        if (userData) {
          const { data: authData } = await supabase.auth.admin.generateLink({
            type: 'magiclink',
            email: userData.email,
            options: { redirectTo: '/' },
          });

          return new Response(
            JSON.stringify({
              success: true,
              isLogin: true,
              magicLink: authData?.properties?.action_link,
              user: {
                id: userData.id,
                email: userData.email,
                fullName: userData.full_name,
                userType: userData.user_type,
              },
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            }
          );
        }
      }

      // Create the user account with a random password
      const randomPassword = generateRandomPassword();
      const displayName = email.split('@')[0];

      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: email.toLowerCase(),
        password: randomPassword,
        email_confirm: true,
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

      // Wait for trigger to create users table entry
      await new Promise(resolve => setTimeout(resolve, 500));

      // Update the users table with phone number
      await supabase
        .from('users')
        .update({ 
          phone: formattedPhone,
          promo_source: promoSource || null,
        })
        .eq('id', authData.user.id);

      // Create user_settings entry
      await supabase
        .from('user_settings')
        .upsert([{ user_id: authData.user.id }], {
          onConflict: 'user_id',
          ignoreDuplicates: true
        });

      // Generate magic link to log them in
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

      console.log('Registration complete for:', email);

      return new Response(
        JSON.stringify({
          success: true,
          isLogin: false,
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
    }
  } catch (error: any) {
    console.error("Error verifying OTP:", error);
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

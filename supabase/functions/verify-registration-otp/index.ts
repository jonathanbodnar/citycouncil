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

    if (!code || !email) {
      throw new Error("Code and email are required");
    }

    const formattedPhone = phone ? formatPhone(phone) : null;
    const normalizedEmail = email.toLowerCase().trim();
    console.log('Verifying OTP for phone:', formattedPhone, 'email:', normalizedEmail);

    // ========== VERIFY OTP CODE ==========
    // Try to find OTP by phone first, then by user_id (for existing users who skipped phone entry)
    let otpData: any = null;
    let otpError: any = null;

    if (formattedPhone) {
      // Try phone lookup first
      console.log('Looking for OTP with phone:', formattedPhone, 'current time:', new Date().toISOString());
      
      // First, let's see ALL OTPs for this phone (debug)
      const { data: allOtps } = await supabase
        .from('phone_otp_codes')
        .select('id, phone, verified, expires_at, created_at, user_id')
        .eq('phone', formattedPhone)
        .order('created_at', { ascending: false })
        .limit(5);
      
      console.log('All OTPs for phone:', JSON.stringify(allOtps));
      
      const result = await supabase
        .from('phone_otp_codes')
        .select('*')
        .eq('phone', formattedPhone)
        .eq('verified', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      otpData = result.data;
      otpError = result.error;
      console.log('Phone lookup result:', { found: !!otpData, error: otpError?.message, code: otpError?.code });
    }

    // If phone lookup failed, try to find by user's email (for existing users)
    if (!otpData) {
      console.log('Phone lookup failed, trying email-based lookup');
      
      // First find the user by email
      const { data: userByEmail } = await supabase
        .from('users')
        .select('id, phone')
        .eq('email', normalizedEmail)
        .single();
      
      if (userByEmail) {
        console.log('Found user by email:', userByEmail.id, 'phone:', userByEmail.phone);
        
        // Try to find OTP by user_id
        const { data: otpByUser } = await supabase
          .from('phone_otp_codes')
          .select('*')
          .eq('user_id', userByEmail.id)
          .eq('verified', false)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        if (otpByUser) {
          otpData = otpByUser;
          console.log('Found OTP by user_id');
        } else if (userByEmail.phone) {
          // Try the user's stored phone
          const userFormattedPhone = formatPhone(userByEmail.phone);
          console.log('Trying user stored phone:', userFormattedPhone);
          
          const { data: otpByStoredPhone } = await supabase
            .from('phone_otp_codes')
            .select('*')
            .eq('phone', userFormattedPhone)
            .eq('verified', false)
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          
          if (otpByStoredPhone) {
            otpData = otpByStoredPhone;
            console.log('Found OTP by user stored phone');
          }
        }
      }
    }

    if (!otpData) {
      console.log('No valid OTP found after all lookups - code may have been used or expired');
      return new Response(
        JSON.stringify({
          success: false,
          error: "Code expired or already used. Please request a new one.",
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

    // ========== SMART USER LOOKUP (double-check at verify time) ==========
    // Re-check for existing user in case something changed between send and verify
    let existingUser: any = null;

    // Check by email first
    const { data: userByEmail } = await supabase
      .from('users')
      .select('id, email, phone, full_name, user_type')
      .eq('email', normalizedEmail)
      .single();

    // Check by phone
    const { data: userByPhone } = await supabase
      .from('users')
      .select('id, email, phone, full_name, user_type')
      .eq('phone', formattedPhone)
      .single();

    // Also check by OTP user_id if set
    let userByOtp: any = null;
    if (otpData.user_id) {
      const { data } = await supabase
        .from('users')
        .select('id, email, phone, full_name, user_type')
        .eq('id', otpData.user_id)
        .single();
      userByOtp = data;
    }

    console.log('Verify lookup:', {
      userByEmail: userByEmail?.id,
      userByPhone: userByPhone?.id,
      userByOtp: userByOtp?.id
    });

    // Determine the existing user (priority: OTP user_id > email > phone)
    if (userByOtp) {
      existingUser = userByOtp;
    } else if (userByEmail) {
      existingUser = userByEmail;
    } else if (userByPhone) {
      existingUser = userByPhone;
    }

    if (existingUser) {
      // ========== LOGIN FLOW ==========
      console.log('Processing as LOGIN for user:', existingUser.id);

      // Sync user data - ensure both phone and email are up to date
      const updates: any = {};
      if (!existingUser.phone || existingUser.phone !== formattedPhone) {
        updates.phone = formattedPhone;
      }
      if (!existingUser.email || existingUser.email !== normalizedEmail) {
        // Only update email if user doesn't have one (rare)
        // Don't overwrite existing email as it's the primary identifier
        if (!existingUser.email) {
          updates.email = normalizedEmail;
        }
      }
      updates.last_login = new Date().toISOString();

      if (Object.keys(updates).length > 0) {
        console.log('Syncing user data:', updates);
        await supabase
          .from('users')
          .update(updates)
          .eq('id', existingUser.id);
      }

      // Check if user exists in auth.users (they might only exist in public.users as a lead)
      const { data: authUserCheck, error: authUserCheckError } = await supabase.auth.admin.getUserById(existingUser.id);
      
      let authUserId = existingUser.id;
      
      if (authUserCheckError || !authUserCheck?.user) {
        // User exists in public.users but NOT in auth.users (they were a lead)
        // We need to create them in auth.users
        console.log('User exists in public.users but not auth.users, creating auth user...');
        
        const randomPassword = generateRandomPassword();
        const { data: newAuthUser, error: createAuthError } = await supabase.auth.admin.createUser({
          email: existingUser.email || normalizedEmail,
          password: randomPassword,
          email_confirm: true,
          user_metadata: {
            full_name: existingUser.full_name || normalizedEmail.split('@')[0],
            phone: formattedPhone,
            user_type: existingUser.user_type || 'user',
          },
        });
        
        if (createAuthError) {
          // Check if user was created by another process (race condition)
          if (createAuthError.message?.includes('already been registered') || createAuthError.message?.includes('already exists')) {
            console.log('Auth user already exists (race condition), continuing...');
            // Try to get the existing auth user by email
            const { data: authUsers } = await supabase.auth.admin.listUsers();
            const existingAuthUser = authUsers?.users?.find(u => u.email === (existingUser.email || normalizedEmail));
            if (existingAuthUser) {
              authUserId = existingAuthUser.id;
              // Update public.users to point to the correct auth user
              if (existingAuthUser.id !== existingUser.id) {
                console.log('Updating public.users to match auth user ID');
                // This is tricky - we have a mismatch. For now, just use the auth user ID
                authUserId = existingAuthUser.id;
              }
            }
          } else {
            console.error('Error creating auth user:', createAuthError);
            throw new Error("Failed to create authentication account");
          }
        } else if (newAuthUser?.user) {
          console.log('Created auth user:', newAuthUser.user.id);
          authUserId = newAuthUser.user.id;
          
          // Update public.users to link to the new auth user ID if different
          if (newAuthUser.user.id !== existingUser.id) {
            console.log('Auth user ID differs from public user ID, updating public.users...');
            // Update the existing public.users record with the new auth user ID
            // First, delete the old record and create a new one with the correct ID
            await supabase.from('users').delete().eq('id', existingUser.id);
            await supabase.from('users').insert({
              id: newAuthUser.user.id,
              email: existingUser.email || normalizedEmail,
              phone: formattedPhone,
              full_name: existingUser.full_name || normalizedEmail.split('@')[0],
              user_type: existingUser.user_type || 'user',
              created_at: existingUser.created_at,
            });
          }
          
          // Wait a moment for triggers
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      // Generate magic link and extract tokens from it
      const { data: authData, error: authError } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: existingUser.email || normalizedEmail,
        options: {
          redirectTo: existingUser.user_type === 'talent' ? '/dashboard' : '/',
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

      // Verify the magic link server-side to get session tokens
      // Parse the token from the magic link URL
      const magicLinkUrlObj = new URL(magicLinkUrl);
      const token = magicLinkUrlObj.searchParams.get('token');
      const type = magicLinkUrlObj.searchParams.get('type');
      
      if (token && type === 'magiclink') {
        // Verify the OTP to get a session
        const { data: sessionData, error: sessionError } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: 'magiclink',
        });
        
        if (sessionError) {
          console.error('Error verifying magic link token:', sessionError);
          // Fall back to returning the magic link URL
          console.log('Falling back to magic link redirect');
          return new Response(
            JSON.stringify({
              success: true,
              isLogin: true,
              magicLink: magicLinkUrl,
              user: {
                id: existingUser.id,
                email: existingUser.email,
                fullName: existingUser.full_name,
                userType: existingUser.user_type,
              },
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            }
          );
        }
        
        if (sessionData.session) {
          console.log('Login successful with direct session for:', existingUser.email);
          return new Response(
            JSON.stringify({
              success: true,
              isLogin: true,
              session: {
                access_token: sessionData.session.access_token,
                refresh_token: sessionData.session.refresh_token,
                expires_in: sessionData.session.expires_in,
                expires_at: sessionData.session.expires_at,
              },
              user: {
                id: existingUser.id,
                email: existingUser.email,
                fullName: existingUser.full_name,
                userType: existingUser.user_type,
              },
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            }
          );
        }
      }

      // Fallback to magic link
      console.log('Login successful (magic link fallback) for:', existingUser.email);

      return new Response(
        JSON.stringify({
          success: true,
          isLogin: true,
          magicLink: magicLinkUrl,
          user: {
            id: existingUser.id,
            email: existingUser.email,
            fullName: existingUser.full_name,
            userType: existingUser.user_type,
          },
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    } else {
      // ========== REGISTRATION FLOW ==========
      console.log('Processing as REGISTRATION for email:', normalizedEmail);

      // Create the user account
      const randomPassword = generateRandomPassword();
      const displayName = normalizedEmail.split('@')[0];

      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: normalizedEmail,
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
        
        // If user already exists (race condition), try to log them in instead
        if (authError.message?.includes('already been registered') || authError.message?.includes('already exists')) {
          console.log('User created during OTP flow (race condition), attempting login');
          
          const { data: raceUser } = await supabase
            .from('users')
            .select('id, email, full_name, user_type')
            .eq('email', normalizedEmail)
            .single();
          
          if (raceUser) {
            const { data: raceAuthData } = await supabase.auth.admin.generateLink({
              type: 'magiclink',
              email: raceUser.email,
              options: { redirectTo: '/' },
            });

            return new Response(
              JSON.stringify({
                success: true,
                isLogin: true,
                magicLink: raceAuthData?.properties?.action_link,
                user: {
                  id: raceUser.id,
                  email: raceUser.email,
                  fullName: raceUser.full_name,
                  userType: raceUser.user_type,
                },
              }),
              {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
              }
            );
          }
        }
        
        throw new Error(authError.message || "Failed to create account");
      }

      console.log('User created:', authData.user.id);

      // Wait for trigger to create users table entry
      await new Promise(resolve => setTimeout(resolve, 500));

      // Update the users table with phone and promo source
      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          phone: formattedPhone,
          promo_source: promoSource || null,
        })
        .eq('id', authData.user.id);

      if (updateError) {
        console.error('Error updating user:', updateError);
        // Don't fail - user is created
      }

      // Create user_settings entry
      await supabase
        .from('user_settings')
        .upsert([{ user_id: authData.user.id }], {
          onConflict: 'user_id',
          ignoreDuplicates: true
        });

      // Generate magic link and extract session tokens
      const { data: magicLinkData, error: magicLinkError } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: normalizedEmail,
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

      // Try to verify the magic link server-side to get session tokens
      const regMagicLinkUrlObj = new URL(magicLinkUrl);
      const regToken = regMagicLinkUrlObj.searchParams.get('token');
      const regType = regMagicLinkUrlObj.searchParams.get('type');
      
      if (regToken && regType === 'magiclink') {
        const { data: regSessionData, error: regSessionError } = await supabase.auth.verifyOtp({
          token_hash: regToken,
          type: 'magiclink',
        });
        
        if (!regSessionError && regSessionData.session) {
          console.log('Registration complete with direct session for:', normalizedEmail);
          return new Response(
            JSON.stringify({
              success: true,
              isLogin: false,
              session: {
                access_token: regSessionData.session.access_token,
                refresh_token: regSessionData.session.refresh_token,
                expires_in: regSessionData.session.expires_in,
                expires_at: regSessionData.session.expires_at,
              },
              user: {
                id: authData.user.id,
                email: normalizedEmail,
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
      }

      // Fallback to magic link
      console.log('Registration complete (magic link fallback) for:', normalizedEmail);

      return new Response(
        JSON.stringify({
          success: true,
          isLogin: false,
          magicLink: magicLinkUrl,
          user: {
            id: authData.user.id,
            email: normalizedEmail,
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

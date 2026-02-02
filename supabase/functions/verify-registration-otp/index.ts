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
      .select('id, email, phone, full_name, user_type, promo_source, utm_sources, sms_subscribed, credits')
      .eq('email', normalizedEmail)
      .single();

    // Check by phone
    const { data: userByPhone } = await supabase
      .from('users')
      .select('id, email, phone, full_name, user_type, promo_source, utm_sources, sms_subscribed, credits')
      .eq('phone', formattedPhone)
      .single();

    // Also check by OTP user_id if set
    let userByOtp: any = null;
    if (otpData.user_id) {
      const { data } = await supabase
        .from('users')
        .select('id, email, phone, full_name, user_type, promo_source, utm_sources, sms_subscribed, credits')
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
    // IMPORTANT: Prefer email over phone because giveaway captures email first with UTM
    if (userByOtp) {
      existingUser = userByOtp;
    } else if (userByEmail) {
      // Prefer email user - giveaway creates user with email+UTM first
      existingUser = userByEmail;
      
      // If there's also a phone-only user, clean it up
      if (userByPhone && userByPhone.id !== userByEmail.id && !userByPhone.email) {
        console.log('Found phone-only placeholder user, will merge into email user');
        // Copy any useful data from phone user before deleting
        if (!userByEmail.phone && userByPhone.phone) {
          await supabase.from('users').update({ phone: userByPhone.phone }).eq('id', userByEmail.id);
        }
        // Delete the placeholder
        await supabase.from('users').delete().eq('id', userByPhone.id);
        console.log('Deleted phone-only placeholder user:', userByPhone.id);
      }
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
      // Always update promo_source to most recent UTM (for order attribution)
      // Also append to utm_sources array to track all sources
      if (promoSource) {
        updates.promo_source = promoSource;
        
        // Append to utm_sources array if not already present
        const existingUtms = existingUser.utm_sources || [];
        if (!existingUtms.includes(promoSource)) {
          // Use raw SQL to append to array since Supabase JS doesn't support array_append
          const { error: rpcError } = await supabase.rpc('append_utm_source', { 
            user_id_param: existingUser.id, 
            utm_param: promoSource 
          });
          if (rpcError) {
            // Fallback: just set the array if RPC doesn't exist
            console.log('RPC failed, using fallback:', rpcError.message);
            updates.utm_sources = [...existingUtms, promoSource];
          }
          console.log('Appended UTM to utm_sources:', promoSource);
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
      const oldPublicUserId = existingUser.id;
      
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
            phone: formattedPhone || existingUser.phone,
            user_type: existingUser.user_type || 'user',
            promo_source: existingUser.promo_source, // IMPORTANT: Preserve UTM
          },
        });
        
        if (createAuthError) {
          // Check if user was created by another process (race condition)
          if (createAuthError.message?.includes('already been registered') || createAuthError.message?.includes('already exists')) {
            console.log('Auth user already exists (race condition), finding them...');
            // Try to get the existing auth user by email
            const { data: authUsers } = await supabase.auth.admin.listUsers();
            const existingAuthUser = authUsers?.users?.find(u => u.email === (existingUser.email || normalizedEmail));
            if (existingAuthUser) {
              authUserId = existingAuthUser.id;
            }
          } else {
            console.error('Error creating auth user:', createAuthError);
            throw new Error("Failed to create authentication account");
          }
        } else if (newAuthUser?.user) {
          console.log('Created auth user:', newAuthUser.user.id);
          authUserId = newAuthUser.user.id;
        }
        
        // If the auth user ID differs from the public user ID, we need to migrate data
        if (authUserId !== oldPublicUserId) {
          console.log('Migrating user data from', oldPublicUserId, 'to', authUserId);
          
          // CRITICAL: First upsert the new user record WITH ALL DATA including promo_source
          // Do this BEFORE deleting old record to beat any trigger that might create empty record
          const userData = {
            id: authUserId,
            email: existingUser.email || normalizedEmail,
            phone: formattedPhone || existingUser.phone,
            full_name: existingUser.full_name || normalizedEmail.split('@')[0],
            user_type: existingUser.user_type || 'user',
            promo_source: existingUser.promo_source, // PRESERVE UTM!
            sms_subscribed: existingUser.sms_subscribed ?? true,
            credits: existingUser.credits || 0,
            created_at: existingUser.created_at || new Date().toISOString(),
          };
          
          console.log('Creating/updating new user record with:', userData);
          
          // Use upsert to either create or update - this beats the trigger
          const { error: upsertError } = await supabase.from('users').upsert(userData);
          
          if (upsertError) {
            console.log('Upsert error:', upsertError.message);
            // Try update as fallback (if trigger already created the record)
            await new Promise(resolve => setTimeout(resolve, 300));
            const { error: updateError } = await supabase.from('users')
              .update(userData)
              .eq('id', authUserId);
            if (updateError) {
              console.log('Update also failed:', updateError.message);
            }
          }
          
          // Now update related tables to point to new user ID
          const tablesToUpdate = [
            { table: 'orders', column: 'user_id' },
            { table: 'reviews', column: 'user_id' },
            { table: 'user_settings', column: 'user_id' },
            { table: 'user_credits', column: 'user_id' },
            { table: 'credit_transactions', column: 'user_id' },
          ];
          
          for (const { table, column } of tablesToUpdate) {
            const { error: updateError } = await supabase
              .from(table)
              .update({ [column]: authUserId })
              .eq(column, oldPublicUserId);
            
            if (updateError) {
              console.log(`Note: Could not update ${table}.${column}:`, updateError.message);
            } else {
              console.log(`Updated ${table}.${column}`);
            }
          }
          
          // Now delete the old public.users record
          const { error: deleteError } = await supabase.from('users').delete().eq('id', oldPublicUserId);
          if (deleteError) {
            console.log('Note: Could not delete old user record:', deleteError.message);
          }
          
          // Update existingUser reference for the rest of the function
          existingUser.id = authUserId;
        }
      }

      // FINAL SAFETY: Ensure promo_source is preserved on the user record
      // This runs after any trigger has completed
      if (existingUser.promo_source) {
        console.log('FINAL: Ensuring promo_source is preserved:', existingUser.promo_source);
        const { error: finalPromoError } = await supabase.from('users')
          .update({ 
            promo_source: existingUser.promo_source,
            phone: formattedPhone || existingUser.phone,
          })
          .eq('id', existingUser.id);
        
        if (finalPromoError) {
          console.log('FINAL promo_source update error:', finalPromoError.message);
        } else {
          console.log('FINAL promo_source update SUCCESS');
        }
        
        // Verify it was saved
        const { data: verifyUser } = await supabase.from('users')
          .select('id, promo_source, phone')
          .eq('id', existingUser.id)
          .single();
        console.log('VERIFY user after final update:', verifyUser);
      }

      // Generate a temporary password and sign in the user
      const tempPassword = generateRandomPassword();
      
      // Update the user's password using admin API
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        existingUser.id,
        { password: tempPassword }
      );
      
      if (updateError) {
        console.error('Error updating user password:', updateError);
        console.error('Update error details:', JSON.stringify(updateError));
        
        // Try to recover by checking if user exists in auth
        const { data: authCheck } = await supabase.auth.admin.getUserById(existingUser.id);
        if (!authCheck?.user) {
          // User doesn't exist in auth - try to create them
          console.log('User not in auth.users, attempting to create...');
          const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
            email: existingUser.email || normalizedEmail,
            password: tempPassword,
            email_confirm: true,
            user_metadata: {
              full_name: existingUser.full_name,
              phone: formattedPhone || existingUser.phone,
            }
          });
          
          if (createError) {
            console.error('Failed to create auth user:', createError);
            throw new Error(`Failed to authenticate user: ${updateError.message}`);
          }
          
          // Update existingUser.id to new auth user id if different
          if (newUser?.user && newUser.user.id !== existingUser.id) {
            console.log('Created new auth user, migrating data...');
            await supabase.from('users').upsert({
              id: newUser.user.id,
              email: existingUser.email || normalizedEmail,
              phone: formattedPhone || existingUser.phone,
              full_name: existingUser.full_name,
              promo_source: existingUser.promo_source,
            });
            existingUser.id = newUser.user.id;
          }
        } else {
          throw new Error(`Failed to authenticate user: ${updateError.message}`);
        }
      }
      
      // Create a fresh client with anon key for signing in (not service role)
      // This ensures the session is created properly for client use
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const anonClient = createClient(supabaseUrl, anonKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
      
      // Sign in with the anon client
      const { data: signInData, error: signInError } = await anonClient.auth.signInWithPassword({
        email: existingUser.email || normalizedEmail,
        password: tempPassword,
      });
      
      if (signInError || !signInData.session) {
        console.error('Error signing in user:', signInError);
        console.error('Sign-in error details:', JSON.stringify(signInError));
        console.error('Attempted sign-in with email:', existingUser.email || normalizedEmail);
        throw new Error(`Failed to authenticate user: ${signInError?.message || 'No session returned'}`);
      }
      
      console.log('Login successful for:', existingUser.email);

      // ABSOLUTE FINAL: One more update to guarantee promo_source and phone are preserved
      // This is the last thing we do before returning
      if (existingUser.promo_source || existingUser.phone) {
        console.log('ABSOLUTE FINAL update - promo_source:', existingUser.promo_source, 'phone:', existingUser.phone || formattedPhone);
        await supabase.from('users').update({
          promo_source: existingUser.promo_source,
          phone: formattedPhone || existingUser.phone,
        }).eq('id', existingUser.id);
      }

      return new Response(
        JSON.stringify({
          success: true,
          isLogin: true,
          session: {
            access_token: signInData.session.access_token,
            refresh_token: signInData.session.refresh_token,
            expires_in: signInData.session.expires_in,
            expires_at: signInData.session.expires_at,
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
            const raceSiteUrl = Deno.env.get("SITE_URL") || "https://shoutout.us";
            const { data: raceAuthData } = await supabase.auth.admin.generateLink({
              type: 'magiclink',
              email: raceUser.email,
              options: { redirectTo: raceSiteUrl },
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
          utm_sources: promoSource ? [promoSource] : [],
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

      // Create a fresh client with anon key for signing in
      const regAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const regAnonClient = createClient(supabaseUrl, regAnonKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
      
      // Sign in the newly created user with the anon client
      const { data: signInData, error: signInError } = await regAnonClient.auth.signInWithPassword({
        email: normalizedEmail,
        password: randomPassword,
      });
      
      if (signInError || !signInData.session) {
        console.error('Error signing in new user:', signInError);
        throw new Error("Account created but login failed. Please use login page.");
      }
      
      console.log('Registration complete for:', normalizedEmail);

      return new Response(
        JSON.stringify({
          success: true,
          isLogin: false,
          session: {
            access_token: signInData.session.access_token,
            refresh_token: signInData.session.refresh_token,
            expires_in: signInData.session.expires_in,
            expires_at: signInData.session.expires_at,
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

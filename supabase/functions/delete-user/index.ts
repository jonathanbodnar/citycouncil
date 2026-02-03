import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Format phone to E.164
function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return phone.startsWith('+') ? phone : `+${digits}`;
}

// Generate random password
function generatePassword(): string {
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
    
    // Create admin client with service role
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json();
    const { user_id, action, phone, email } = body;

    // ========== RESET-TALENT ACTION ==========
    if (action === 'reset-talent') {
      const { onboarding_token, talent_phone, talent_email } = body;
      console.log('Reset talent action:', { onboarding_token, talent_phone, talent_email });
      
      if (!onboarding_token && !talent_phone && !talent_email) {
        return new Response(
          JSON.stringify({ success: false, error: 'onboarding_token, talent_phone, or talent_email is required' }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
      
      // Find talent profile by token, phone, or email
      let talentProfile: any = null;
      let talentError: any = null;
      
      if (onboarding_token) {
        const result = await supabaseAdmin
          .from('talent_profiles')
          .select('id, user_id, temp_full_name, temp_email, username, onboarding_token')
          .eq('onboarding_token', onboarding_token)
          .single();
        talentProfile = result.data;
        talentError = result.error;
      }
      
      if (!talentProfile && talent_phone) {
        const formattedPhone = formatPhone(talent_phone);
        // Find user by phone, then get their talent profile
        const { data: user } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('phone', formattedPhone)
          .single();
        
        if (user) {
          const result = await supabaseAdmin
            .from('talent_profiles')
            .select('id, user_id, temp_full_name, temp_email, username, onboarding_token')
            .eq('user_id', user.id)
            .single();
          talentProfile = result.data;
          talentError = result.error;
        }
      }
      
      if (!talentProfile && talent_email) {
        // Find by temp_email or user email
        let result = await supabaseAdmin
          .from('talent_profiles')
          .select('id, user_id, temp_full_name, temp_email, username, onboarding_token')
          .eq('temp_email', talent_email.toLowerCase().trim())
          .single();
        
        if (!result.data) {
          // Try finding user by email
          const { data: user } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('email', talent_email.toLowerCase().trim())
            .single();
          
          if (user) {
            result = await supabaseAdmin
              .from('talent_profiles')
              .select('id, user_id, temp_full_name, temp_email, username, onboarding_token')
              .eq('user_id', user.id)
              .single();
          }
        }
        talentProfile = result.data;
        talentError = result.error;
      }
      
      // Debug: List talent profiles and users if none found
      if (!talentProfile) {
        console.log('Could not find talent profile with provided criteria');
        
        // Search for user with this phone
        const formattedPhone = talent_phone ? formatPhone(talent_phone) : null;
        const { data: userWithPhone } = formattedPhone ? await supabaseAdmin
          .from('users')
          .select('id, email, phone, full_name, user_type')
          .eq('phone', formattedPhone)
          .single() : { data: null };
        
        // If we found the user, search talent_profiles by their user_id
        let talentByUserId = null;
        if (userWithPhone) {
          const { data } = await supabaseAdmin
            .from('talent_profiles')
            .select('id, temp_full_name, temp_email, username, onboarding_token, user_id')
            .eq('user_id', userWithPhone.id)
            .single();
          talentByUserId = data;
          
          // If found, use this talent profile
          if (talentByUserId) {
            talentProfile = talentByUserId;
          }
        }
        
        if (!talentProfile) {
          // Search broader - by name, email, or any profile with "chick" in various fields
          const { data: allTalents } = await supabaseAdmin
            .from('talent_profiles')
            .select('id, temp_full_name, temp_email, username, slug, onboarding_token, user_id, bio, is_active')
            .or(`temp_full_name.ilike.%chick%,username.ilike.%chick%,temp_email.ilike.%amy%,temp_email.ilike.%chick%`)
            .limit(20);
          
          // Also get user's full record to help debug
          let userAuthRecord = null;
          if (userWithPhone) {
            const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userWithPhone.id);
            userAuthRecord = authUser?.user ? { id: authUser.user.id, email: authUser.user.email } : null;
            
            // EMAIL MISMATCH FIX - if emails don't match, fix auth.users email
            if (userAuthRecord && userWithPhone.email && userAuthRecord.email !== userWithPhone.email) {
              console.log('EMAIL MISMATCH DETECTED! Fixing auth.users email...');
              console.log('public.users email:', userWithPhone.email);
              console.log('auth.users email:', userAuthRecord.email);
              
              const { error: fixError } = await supabaseAdmin.auth.admin.updateUserById(
                userWithPhone.id,
                { email: userWithPhone.email, email_confirm: true }
              );
              
              if (fixError) {
                console.error('Failed to fix email:', fixError);
              } else {
                console.log('Fixed auth.users email to match public.users');
                
                // Now try to find talent profile again
                const { data: tp } = await supabaseAdmin
                  .from('talent_profiles')
                  .select('id, temp_full_name, temp_email, username, slug, onboarding_token, user_id')
                  .eq('user_id', userWithPhone.id)
                  .single();
                
                return new Response(
                  JSON.stringify({ 
                    success: true, 
                    fixed: true,
                    method: 'email_mismatch_fix',
                    message: 'Fixed email mismatch between auth and public users. User can now try logging in again.',
                    oldAuthEmail: userAuthRecord.email,
                    newAuthEmail: userWithPhone.email,
                    talentProfile: tp
                  }),
                  { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
                );
              }
            }
          }
          
          // Search specifically for chicksonright
          const { data: chicksProfile } = await supabaseAdmin
            .from('talent_profiles')
            .select('*')
            .eq('username', 'chicksonright')
            .single();
          
          // Get recent talent profiles for manual lookup
          const { data: recentTalents } = await supabaseAdmin
            .from('talent_profiles')
            .select('id, temp_full_name, username, slug, user_id, is_active')
            .order('created_at', { ascending: false })
            .limit(30);
          
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'Talent profile not found - broader search results below',
              searchedWith: { onboarding_token, talent_phone, talent_email, formattedPhone },
              userWithPhone: userWithPhone,
              userAuthRecord: userAuthRecord,
              talentByUserId: talentByUserId,
              chicksOnRightProfile: chicksProfile,
              matchingTalents: allTalents || [],
              recentTalents: recentTalents || [],
              hint: 'If you see the talent profile below, provide its username or id'
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
          );
        }
      }
      
      if (talentError || !talentProfile) {
        return new Response(
          JSON.stringify({ success: false, error: 'Talent profile not found with this token' }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
        );
      }
      
      console.log('Found talent:', talentProfile.temp_full_name, 'user_id:', talentProfile.user_id);
      
      // Delete user if exists
      if (talentProfile.user_id) {
        // Delete from public.users
        await supabaseAdmin.from('users').delete().eq('id', talentProfile.user_id);
        console.log('Deleted from public.users');
        
        // Delete from auth.users
        await supabaseAdmin.auth.admin.deleteUser(talentProfile.user_id);
        console.log('Deleted from auth.users');
      }
      
      // Reset talent profile for re-onboarding
      const newExpiry = new Date();
      newExpiry.setDate(newExpiry.getDate() + 30); // 30 days from now
      
      const { error: updateError } = await supabaseAdmin
        .from('talent_profiles')
        .update({
          user_id: null,
          onboarding_completed: false,
          onboarding_expires_at: newExpiry.toISOString(),
          current_onboarding_step: 1,
        })
        .eq('id', talentProfile.id);
      
      if (updateError) {
        console.error('Error updating talent profile:', updateError);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to reset talent profile' }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }
      
      console.log('Talent profile reset successfully');
      
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Talent reset successfully. They can now re-register.',
          talent: {
            name: talentProfile.temp_full_name,
            username: talentProfile.username,
          },
          onboarding_link: `https://shoutout.us/onboard/${onboarding_token}`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // ========== FIX-AUTH ACTION ==========
    if (action === 'fix-auth') {
      console.log('Fix auth action for:', { phone, email });
      
      // Find user in public.users
      let publicUser: any = null;
      
      if (email) {
        const { data } = await supabaseAdmin
          .from('users')
          .select('*')
          .eq('email', email.toLowerCase().trim())
          .single();
        publicUser = data;
      }
      
      if (!publicUser && phone) {
        const formattedPhone = formatPhone(phone);
        const { data } = await supabaseAdmin
          .from('users')
          .select('*')
          .eq('phone', formattedPhone)
          .single();
        publicUser = data;
      }
      
      if (!publicUser) {
        return new Response(
          JSON.stringify({ success: false, error: 'User not found', searchedFor: { phone, email } }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
        );
      }
      
      console.log('Found public user:', publicUser.id, publicUser.email);
      
      // Check if user exists in auth.users by ID
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(publicUser.id);
      
      // Also check by email
      let authUserByEmail: any = null;
      if (publicUser.email) {
        const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
        authUserByEmail = authUsers?.users?.find((u: any) => u.email === publicUser.email);
      }
      
      console.log('Auth check:', { byId: !!authUser?.user, byEmail: authUserByEmail?.id });
      
      const tempPassword = generatePassword();
      let result: any = { publicUser: { id: publicUser.id, email: publicUser.email, phone: publicUser.phone, user_type: publicUser.user_type } };
      
      // Case 1: Auth user exists with same ID - reset password
      if (authUser?.user) {
        console.log('Case 1: Resetting password for existing auth user');
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
          authUser.user.id,
          { password: tempPassword, email_confirm: true }
        );
        
        if (updateError) {
          result.error = `Failed to reset password: ${updateError.message}`;
        } else {
          result.fixed = true;
          result.method = 'password_reset';
        }
      }
      // Case 2: Auth user exists by email with different ID - sync IDs
      else if (authUserByEmail && authUserByEmail.id !== publicUser.id) {
        console.log('Case 2: Syncing IDs');
        const oldId = publicUser.id;
        const newId = authUserByEmail.id;
        
        // Update public.users with new ID
        await supabaseAdmin.from('users').upsert({
          id: newId,
          email: publicUser.email,
          phone: publicUser.phone,
          full_name: publicUser.full_name,
          user_type: publicUser.user_type,
          promo_source: publicUser.promo_source,
          sms_subscribed: publicUser.sms_subscribed,
          credits: publicUser.credits,
        });
        
        // Update related tables
        for (const table of ['orders', 'talent_profiles', 'reviews', 'talent_followers', 'help_messages']) {
          await supabaseAdmin.from(table).update({ user_id: newId }).eq('user_id', oldId);
        }
        
        // Delete old record
        await supabaseAdmin.from('users').delete().eq('id', oldId);
        
        // Reset password
        await supabaseAdmin.auth.admin.updateUserById(newId, { password: tempPassword, email_confirm: true });
        
        result.fixed = true;
        result.method = 'id_sync';
        result.oldId = oldId;
        result.newId = newId;
      }
      // Case 3: No auth user - create one
      else {
        console.log('Case 3: Creating new auth user');
        const { data: newAuthUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: publicUser.email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            full_name: publicUser.full_name,
            phone: publicUser.phone,
            user_type: publicUser.user_type,
          }
        });
        
        if (createError) {
          result.error = `Failed to create auth user: ${createError.message}`;
        } else if (newAuthUser?.user) {
          // Sync IDs if different
          if (newAuthUser.user.id !== publicUser.id) {
            const oldId = publicUser.id;
            const newId = newAuthUser.user.id;
            
            await supabaseAdmin.from('users').upsert({
              id: newId,
              email: publicUser.email,
              phone: publicUser.phone,
              full_name: publicUser.full_name,
              user_type: publicUser.user_type,
              promo_source: publicUser.promo_source,
              sms_subscribed: publicUser.sms_subscribed,
              credits: publicUser.credits,
            });
            
            for (const table of ['orders', 'talent_profiles', 'reviews', 'talent_followers', 'help_messages']) {
              await supabaseAdmin.from(table).update({ user_id: newId }).eq('user_id', oldId);
            }
            
            await supabaseAdmin.from('users').delete().eq('id', oldId);
            
            result.oldId = oldId;
            result.newId = newId;
          }
          result.fixed = true;
          result.method = 'created_auth';
        }
      }
      
      return new Response(
        JSON.stringify({ success: true, ...result }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // ========== DELETE USER ACTION (default) ==========
    if (!user_id) {
      return new Response(
        JSON.stringify({ success: false, error: "user_id is required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    console.log('Deleting user:', user_id);

    // First check if user is an admin (don't allow deleting admins)
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('user_type, email')
      .eq('id', user_id)
      .single();

    if (userError && userError.code !== 'PGRST116') {
      console.error('Error fetching user:', userError);
    }

    if (userData?.user_type === 'admin') {
      return new Response(
        JSON.stringify({ success: false, error: "Cannot delete admin users" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    // Delete from public.users table first (this may cascade to other tables)
    const { error: publicDeleteError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', user_id);

    if (publicDeleteError) {
      console.error('Error deleting from public.users:', publicDeleteError);
      // Continue anyway - user might only exist in auth
    } else {
      console.log('Deleted from public.users');
    }

    // Delete from auth.users using admin API
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id);

    if (authDeleteError) {
      console.error('Error deleting from auth.users:', authDeleteError);
      // If auth delete fails but public delete succeeded, that's okay
      // The user won't be able to log in anyway
    } else {
      console.log('Deleted from auth.users');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `User ${userData?.email || user_id} deleted successfully`,
        deleted_from_public: !publicDeleteError,
        deleted_from_auth: !authDeleteError
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error: any) {
    console.error("Error deleting user:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Failed to delete user" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});


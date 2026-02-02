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

// Generate a random password
function generateRandomPassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 32; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

serve(async (req) => {
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

    const { phone, email, action } = await req.json();

    if (!phone && !email) {
      throw new Error("Phone or email is required");
    }

    const formattedPhone = phone ? formatPhone(phone) : null;
    const normalizedEmail = email ? email.toLowerCase().trim() : null;

    console.log('Admin fix auth for:', { phone: formattedPhone, email: normalizedEmail, action });

    // Find the user in public.users
    let publicUser: any = null;
    
    if (normalizedEmail) {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('email', normalizedEmail)
        .single();
      publicUser = data;
    }
    
    if (!publicUser && formattedPhone) {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('phone', formattedPhone)
        .single();
      publicUser = data;
    }

    if (!publicUser) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "User not found in public.users",
          searchedFor: { phone: formattedPhone, email: normalizedEmail }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    console.log('Found public user:', publicUser.id, publicUser.email, publicUser.user_type);

    // Check if user exists in auth.users
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(publicUser.id);
    
    console.log('Auth user check:', { 
      exists: !!authUser?.user, 
      error: authError?.message,
      authEmail: authUser?.user?.email 
    });

    // Also try to find by email in auth
    let authUserByEmail: any = null;
    if (publicUser.email) {
      const { data: authUsers } = await supabase.auth.admin.listUsers();
      authUserByEmail = authUsers?.users?.find(u => u.email === publicUser.email);
      console.log('Auth user by email:', authUserByEmail?.id);
    }

    const result: any = {
      publicUser: {
        id: publicUser.id,
        email: publicUser.email,
        phone: publicUser.phone,
        full_name: publicUser.full_name,
        user_type: publicUser.user_type,
      },
      authUserById: authUser?.user ? {
        id: authUser.user.id,
        email: authUser.user.email,
      } : null,
      authUserByEmail: authUserByEmail ? {
        id: authUserByEmail.id,
        email: authUserByEmail.email,
      } : null,
    };

    // If action is 'fix', attempt to fix the auth situation
    if (action === 'fix') {
      const tempPassword = generateRandomPassword();
      
      // Case 1: Auth user exists with same ID - just reset password
      if (authUser?.user) {
        console.log('Resetting password for existing auth user');
        const { error: updateError } = await supabase.auth.admin.updateUserById(
          authUser.user.id,
          { password: tempPassword, email_confirm: true }
        );
        
        if (updateError) {
          result.fixError = `Failed to reset password: ${updateError.message}`;
        } else {
          result.fixed = true;
          result.fixMethod = 'password_reset';
          result.message = 'Password reset successfully. User can now request a new OTP.';
        }
      }
      // Case 2: Auth user exists with different ID (by email) - need to sync
      else if (authUserByEmail && authUserByEmail.id !== publicUser.id) {
        console.log('Auth user ID mismatch, syncing public.users to auth.users ID');
        
        // Update public.users to use the auth.users ID
        const oldId = publicUser.id;
        const newId = authUserByEmail.id;
        
        // Update the public user record
        const { error: upsertError } = await supabase.from('users').upsert({
          id: newId,
          email: publicUser.email,
          phone: publicUser.phone,
          full_name: publicUser.full_name,
          user_type: publicUser.user_type,
          promo_source: publicUser.promo_source,
          sms_subscribed: publicUser.sms_subscribed,
          credits: publicUser.credits,
        });
        
        if (upsertError) {
          result.fixError = `Failed to sync user IDs: ${upsertError.message}`;
        } else {
          // Update related tables
          const tables = ['orders', 'talent_profiles', 'reviews', 'talent_followers'];
          for (const table of tables) {
            await supabase.from(table).update({ user_id: newId }).eq('user_id', oldId);
          }
          
          // Delete old record if different
          if (oldId !== newId) {
            await supabase.from('users').delete().eq('id', oldId);
          }
          
          // Reset password
          await supabase.auth.admin.updateUserById(newId, { password: tempPassword, email_confirm: true });
          
          result.fixed = true;
          result.fixMethod = 'id_sync';
          result.oldId = oldId;
          result.newId = newId;
          result.message = 'User IDs synced and password reset. User can now request a new OTP.';
        }
      }
      // Case 3: No auth user exists - create one
      else if (!authUser?.user && !authUserByEmail) {
        console.log('Creating new auth user');
        
        const { data: newAuthUser, error: createError } = await supabase.auth.admin.createUser({
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
          result.fixError = `Failed to create auth user: ${createError.message}`;
        } else if (newAuthUser?.user) {
          // If new auth user has different ID, sync public.users
          if (newAuthUser.user.id !== publicUser.id) {
            const oldId = publicUser.id;
            const newId = newAuthUser.user.id;
            
            await supabase.from('users').upsert({
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
            const tables = ['orders', 'talent_profiles', 'reviews', 'talent_followers'];
            for (const table of tables) {
              await supabase.from(table).update({ user_id: newId }).eq('user_id', oldId);
            }
            
            await supabase.from('users').delete().eq('id', oldId);
            
            result.oldId = oldId;
            result.newId = newId;
          }
          
          result.fixed = true;
          result.fixMethod = 'created_auth_user';
          result.message = 'Auth user created. User can now request a new OTP.';
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

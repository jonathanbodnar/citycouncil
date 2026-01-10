import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const { user_id } = await req.json();

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


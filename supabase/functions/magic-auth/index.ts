import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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
    const { magicToken } = await req.json();

    if (!magicToken) {
      throw new Error("Missing magic token");
    }

    // Create Supabase client with service role (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Verify and consume the magic token
    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from('fulfillment_auth_tokens')
      .select('*')
      .eq('token', magicToken)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (tokenError || !tokenData) {
      console.error('Invalid or expired magic token:', tokenError);
      throw new Error("Invalid or expired magic token");
    }

    // Mark token as used
    await supabaseAdmin
      .from('fulfillment_auth_tokens')
      .update({ 
        used: true, 
        used_at: new Date().toISOString() 
      })
      .eq('id', tokenData.id);

    // Get user details
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .eq('id', tokenData.user_id)
      .single();

    if (userError || !user) {
      throw new Error("User not found");
    }

    // Generate a session for the user using admin API
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: user.email,
      options: {
        redirectTo: `${Deno.env.get("SUPABASE_URL")}/auth/v1/verify`,
      }
    });

    if (sessionError || !sessionData) {
      console.error('Session generation error:', sessionError);
      throw new Error("Failed to generate session");
    }

    console.log('✅ Magic auth successful for user:', user.email);

    return new Response(
      JSON.stringify({
        success: true,
        user_id: user.id,
        order_id: tokenData.order_id,
        // Return the hashed token URL that can be used to sign in
        auth_url: sessionData.properties?.hashed_token 
          ? `${Deno.env.get("SUPABASE_URL")}/auth/v1/verify?token=${sessionData.properties.hashed_token}&type=magiclink`
          : null
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in magic-auth:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Authentication failed",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});


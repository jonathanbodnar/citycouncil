import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { code, talentId } = await req.json();

    if (!code || !talentId) {
      return new Response(
        JSON.stringify({ error: 'Missing code or talentId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get credentials from environment (NEVER hardcoded)
    const INSTAGRAM_APP_ID = Deno.env.get('INSTAGRAM_APP_ID');
    const INSTAGRAM_APP_SECRET = Deno.env.get('INSTAGRAM_APP_SECRET');
    const REDIRECT_URI = Deno.env.get('INSTAGRAM_REDIRECT_URI');

    if (!INSTAGRAM_APP_ID || !INSTAGRAM_APP_SECRET || !REDIRECT_URI) {
      console.error('Missing Instagram credentials in environment');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Exchanging code for access token...');

    // Step 1: Exchange authorization code for short-lived token
    const tokenFormData = new FormData();
    tokenFormData.append('client_id', INSTAGRAM_APP_ID);
    tokenFormData.append('client_secret', INSTAGRAM_APP_SECRET);
    tokenFormData.append('grant_type', 'authorization_code');
    tokenFormData.append('redirect_uri', REDIRECT_URI);
    tokenFormData.append('code', code);

    const tokenResponse = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      body: tokenFormData,
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to exchange token', details: errorText }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenData = await tokenResponse.json();
    const shortLivedToken = tokenData.access_token;
    const userId = tokenData.user_id;

    console.log('Got short-lived token, exchanging for long-lived token...');

    // Step 2: Exchange short-lived token for long-lived token (60 days)
    const longLivedResponse = await fetch(
      `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${INSTAGRAM_APP_SECRET}&access_token=${shortLivedToken}`
    );

    if (!longLivedResponse.ok) {
      const errorText = await longLivedResponse.text();
      console.error('Long-lived token exchange failed:', errorText);
      // Fall back to short-lived token if long-lived fails
      console.log('Falling back to short-lived token');
    }

    const longLivedData = await longLivedResponse.json();
    const accessToken = longLivedData.access_token || shortLivedToken;
    const expiresIn = longLivedData.expires_in || 3600; // Default 1 hour if short-lived

    // Step 3: Get user profile info
    const profileResponse = await fetch(
      `https://graph.instagram.com/${userId}?fields=username&access_token=${accessToken}`
    );

    if (!profileResponse.ok) {
      const errorText = await profileResponse.text();
      console.error('Profile fetch failed:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch profile', details: errorText }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const profileData = await profileResponse.json();
    const username = profileData.username;

    console.log(`Successfully authorized @${username}`);

    // Step 4: Save to database
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    const { error: updateError } = await supabase
      .from('talent_profiles')
      .update({
        instagram_username: username,
        instagram_user_id: userId,
        instagram_access_token: accessToken,
        instagram_token_expires_at: expiresAt
      })
      .eq('id', talentId);

    if (updateError) {
      console.error('Database update failed:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to save credentials', details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Instagram connected successfully!');

    return new Response(
      JSON.stringify({ 
        success: true, 
        username,
        expiresAt 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Instagram OAuth error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});


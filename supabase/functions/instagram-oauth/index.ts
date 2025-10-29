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

    // Step 1: Exchange authorization code for access token (Facebook Graph API)
    const tokenUrl = new URL('https://graph.facebook.com/v18.0/oauth/access_token');
    tokenUrl.searchParams.append('client_id', INSTAGRAM_APP_ID);
    tokenUrl.searchParams.append('client_secret', INSTAGRAM_APP_SECRET);
    tokenUrl.searchParams.append('code', code);
    tokenUrl.searchParams.append('redirect_uri', REDIRECT_URI);

    const tokenResponse = await fetch(tokenUrl.toString());

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to exchange token', details: errorText }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    
    console.log('Got Facebook access token, fetching Instagram Business Account...');

    // Step 2: Get user's Facebook pages (Instagram Business accounts are linked to Pages)
    const pagesResponse = await fetch(
      `https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}`
    );

    if (!pagesResponse.ok) {
      const errorText = await pagesResponse.text();
      console.error('Failed to fetch pages:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch Facebook pages', details: errorText }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const pagesData = await pagesResponse.json();
    const pages = pagesData.data || [];

    if (pages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No Facebook pages found. Instagram Business accounts must be linked to a Facebook Page.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 3: Get Instagram Business Account from the first page
    const pageId = pages[0].id;
    const pageAccessToken = pages[0].access_token;

    const igAccountResponse = await fetch(
      `https://graph.facebook.com/v18.0/${pageId}?fields=instagram_business_account&access_token=${pageAccessToken}`
    );

    if (!igAccountResponse.ok) {
      const errorText = await igAccountResponse.text();
      console.error('Failed to fetch Instagram account:', errorText);
      return new Response(
        JSON.stringify({ error: 'No Instagram Business account found for this Facebook Page', details: errorText }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const igAccountData = await igAccountResponse.json();
    const igUserId = igAccountData.instagram_business_account?.id;

    if (!igUserId) {
      return new Response(
        JSON.stringify({ error: 'No Instagram Business account linked to this Facebook Page' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 4: Get Instagram username
    const igProfileResponse = await fetch(
      `https://graph.facebook.com/v18.0/${igUserId}?fields=username&access_token=${pageAccessToken}`
    );

    if (!igProfileResponse.ok) {
      const errorText = await igProfileResponse.text();
      console.error('Failed to fetch Instagram profile:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch Instagram profile', details: errorText }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const igProfileData = await igProfileResponse.json();
    const username = igProfileData.username;

    console.log(`Successfully authorized Instagram Business account: @${username}`);

    // Use page access token for Instagram API calls (doesn't expire if page token is long-lived)
    const finalAccessToken = pageAccessToken;
    const expiresIn = 5184000; // 60 days

    // Step 5: Save to database
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    const { error: updateError } = await supabase
      .from('talent_profiles')
      .update({
        instagram_username: username,
        instagram_user_id: igUserId,
        instagram_access_token: finalAccessToken,
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


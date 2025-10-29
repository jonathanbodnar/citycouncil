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
    
    console.log('Got Facebook access token, trying Business account first...');

    // Step 2: Try to get Instagram Business account (via Facebook Pages)
    let username = null;
    let igUserId = null;
    let finalAccessToken = null;
    let expiresIn = 5184000; // 60 days default
    let accountType = 'business';

    try {
      const pagesResponse = await fetch(
        `https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}`
      );

      if (pagesResponse.ok) {
        const pagesData = await pagesResponse.json();
        const pages = pagesData.data || [];

        if (pages.length > 0) {
          // Try to find Instagram Business account
          for (const page of pages) {
            const pageId = page.id;
            const pageAccessToken = page.access_token;

            const igAccountResponse = await fetch(
              `https://graph.facebook.com/v18.0/${pageId}?fields=instagram_business_account&access_token=${pageAccessToken}`
            );

            if (igAccountResponse.ok) {
              const igAccountData = await igAccountResponse.json();
              const businessAccountId = igAccountData.instagram_business_account?.id;

              if (businessAccountId) {
                // Found a business account!
                const igProfileResponse = await fetch(
                  `https://graph.facebook.com/v18.0/${businessAccountId}?fields=username&access_token=${pageAccessToken}`
                );

                if (igProfileResponse.ok) {
                  const igProfileData = await igProfileResponse.json();
                  username = igProfileData.username;
                  igUserId = businessAccountId;
                  finalAccessToken = pageAccessToken;
                  console.log(`Found Instagram Business account: @${username}`);
                  break;
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.log('Business account fetch failed, will try personal account:', error);
    }

    // Step 3: If no Business account found, return error with instructions
    if (!username) {
      console.log('No Business account found');
      return new Response(
        JSON.stringify({ 
          error: 'no_business_account',
          message: 'No Instagram Business account found',
          details: 'Only Instagram Business or Creator accounts can be connected automatically. Please convert your Instagram account to a Business account, or enter your Instagram username manually for basic tracking.'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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


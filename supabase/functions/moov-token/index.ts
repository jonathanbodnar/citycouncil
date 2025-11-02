// @ts-ignore - Deno std import for Supabase Edge Functions
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-ignore - Deno npm import is resolved at runtime in Edge Functions
import { Moov } from 'npm:@moovio/sdk'

// ⚠️ Move to Supabase secrets for production:
// npx supabase secrets set MOOV_PUBLIC_KEY=...
// npx supabase secrets set MOOV_SECRET_KEY=...
const MOOV_PUBLIC_KEY =  'rEvCk_pOVqe5Pi73'
const MOOV_SECRET_KEY ='odUP-ZAPFaA1WMZqSh6ioi4qEeJBvn-z'
const MOOV_VERSION = 'v2024.01.00'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const payload = await req.json().catch(() => ({}))
    const scope: string = payload?.scope || '/accounts.write'

    const moov = new Moov({
      xMoovVersion: MOOV_VERSION,
      security: {
        username: MOOV_PUBLIC_KEY,
        password: MOOV_SECRET_KEY,
      },
    })

    const response = await moov.authentication.createAccessToken({
      grantType: 'client_credentials',
      scope,
    })

    // 💡 YOUR FIX APPLIED: Check for the nested "result" object
    // and the "accessToken" property within it.
    const tokenData = response?.result;

    if (!tokenData?.accessToken) {
      // Log the full response for debugging if it fails
      console.error('Moov API failed to return token:', response);
      return new Response(JSON.stringify({ error: 'Failed to create access token', details: response }), {
        status: 502, // Bad Gateway
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ✅ CLEANED UP RESPONSE: Return the standard OAuth2 JSON format
    // by unwrapping the 'result' object.
    return new Response(
      JSON.stringify({
        access_token: tokenData.accessToken,
        token_type: 'Bearer',
        scope: tokenData.scope,
        expires_in: tokenData.expiresIn,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('Moov SDK Error:', error)
    return new Response(JSON.stringify({ error: error.message || String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})


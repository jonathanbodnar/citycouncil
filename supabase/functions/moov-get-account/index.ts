// @ts-ignore - Deno std import for Supabase Edge Functions
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-ignore - Deno npm import is resolved at runtime in Edge Functions
import { Moov } from 'npm:@moovio/sdk'

// @ts-ignore - available at runtime in Edge Functions
const MOOV_PUBLIC_KEY = (globalThis as any).Deno?.env.get('MOOV_PUBLIC_KEY')
// @ts-ignore - available at runtime in Edge Functions
const MOOV_SECRET_KEY = (globalThis as any).Deno?.env.get('MOOV_SECRET_KEY')
const MOOV_VERSION = 'v2024.01.00'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type'
}

serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { accountId } = body
    console.log('moov-get-account called with:', JSON.stringify(body))
    
    if (!accountId) {
      throw new Error('Missing accountId in request body')
    }

    console.log('Looking up Moov account:', accountId)

    // 2. Call Moov
    const moov = new Moov({
      xMoovVersion: MOOV_VERSION,
      security: { username: MOOV_PUBLIC_KEY, password: MOOV_SECRET_KEY }
    })

    console.log('Calling moov.accounts.get...')
    const response = await moov.accounts.get({ accountID: accountId })
    console.log('Moov response:', JSON.stringify(response))

    const account = (response as any)?.result

    if (!account?.accountID) {
      console.error('No accountID in response:', JSON.stringify(response))
      throw new Error('Failed to retrieve account from Moov')
    }

    console.log('Returning account:', account.accountID)
    // 3. Return the full account object
    return new Response(JSON.stringify(account), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error: any) {
    console.error('Moov Get Account Error:', error.message)
    console.error('Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error)))
    return new Response(
      JSON.stringify({ error: error?.message || String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

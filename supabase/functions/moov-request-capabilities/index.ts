// @ts-ignore - Deno std import for Supabase Edge Functions
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-ignore - Deno npm import is resolved at runtime in Edge Functions
import { Moov } from 'npm:@moovio/sdk'

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
    // Load secrets inside request handler (required for Supabase Edge Functions)
    // @ts-ignore
    const MOOV_PUBLIC_KEY = (globalThis as any).Deno?.env.get('MOOV_PUBLIC_KEY')
    // @ts-ignore
    const MOOV_SECRET_KEY = (globalThis as any).Deno?.env.get('MOOV_SECRET_KEY')

    console.log('Moov credentials check:', { 
      hasPublicKey: !!MOOV_PUBLIC_KEY, 
      hasSecretKey: !!MOOV_SECRET_KEY 
    })

    if (!MOOV_PUBLIC_KEY || !MOOV_SECRET_KEY) {
      throw new Error('Moov credentials not configured')
    }

    const { moovAccountId, capabilities } = await req.json()
    
    console.log('Requesting capabilities for account:', moovAccountId)
    console.log('Capabilities to request:', capabilities)

    if (!moovAccountId) {
      throw new Error('Missing moovAccountId in request body')
    }

    // Default capabilities if not specified
    const capsToRequest = capabilities || ['transfers', 'send-funds']

    const moov = new Moov({
      xMoovVersion: MOOV_VERSION,
      security: { username: MOOV_PUBLIC_KEY, password: MOOV_SECRET_KEY }
    })

    // Request capabilities on existing account
    const response = await moov.capabilities.request({
      accountID: moovAccountId,
      addCapabilities: {
        capabilities: capsToRequest
      }
    })

    console.log('Moov request capabilities response:', JSON.stringify(response))

    return new Response(JSON.stringify({ 
      success: true, 
      capabilities: response?.result || response 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error: any) {
    console.error('Moov Request Capabilities Error:', error.message)
    console.error('Error stack:', error?.stack)
    return new Response(
      JSON.stringify({ error: error?.message || String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})


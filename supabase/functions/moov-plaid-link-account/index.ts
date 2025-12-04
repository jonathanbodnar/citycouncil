// @ts-ignore - Deno std import
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-ignore - Deno npm import
import { PlaidApi, Configuration, PlaidEnvironments } from 'npm:plaid'

// @ts-ignore
const PLAID_CLIENT_ID = (globalThis as any).Deno?.env.get('PLAID_CLIENT_ID')
// @ts-ignore
const PLAID_SECRET = (globalThis as any).Deno?.env.get('PLAID_SECRET')
// @ts-ignore
const MOOV_PUBLIC_KEY = (globalThis as any).Deno?.env.get('MOOV_PUBLIC_KEY')
// @ts-ignore
const MOOV_SECRET_KEY = (globalThis as any).Deno?.env.get('MOOV_SECRET_KEY')

const config = new Configuration({
  basePath: PlaidEnvironments.production,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': PLAID_CLIENT_ID!,
      'PLAID-SECRET': PLAID_SECRET!,
    },
  },
})

const plaidClient = new PlaidApi(config)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type'
}

serve(async req => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('moov-plaid-link-account: Starting...')
    console.log('Plaid Client ID configured:', !!PLAID_CLIENT_ID)
    console.log('Plaid Secret configured:', !!PLAID_SECRET)
    console.log('Moov Public Key configured:', !!MOOV_PUBLIC_KEY)
    console.log('Moov Secret Key configured:', !!MOOV_SECRET_KEY)

    if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
      throw new Error('Plaid credentials not configured')
    }

    if (!MOOV_PUBLIC_KEY || !MOOV_SECRET_KEY) {
      throw new Error('Moov credentials not configured')
    }

    const body = await req.json()
    console.log('Request body received:', JSON.stringify({
      public_token: body.public_token ? 'present' : 'missing',
      account_id: body.account_id,
      moov_account_id: body.moov_account_id
    }))
    
    const { public_token, account_id, moov_account_id } = body
    
    if (!public_token || !account_id || !moov_account_id) {
      throw new Error(
        'public_token, account_id, and moov_account_id are required'
      )
    }

    // Step 1: Exchange Plaid public token for access token using SDK
    console.log('Step 1: Exchanging Plaid public token...')
    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token
    })
    const access_token = exchangeResponse.data.access_token
    console.log('Public token exchanged successfully')

    // Step 2: Create processor token for Moov using SDK
    console.log('Step 2: Creating Plaid processor token for Moov...')
    const processorResponse = await plaidClient.processorTokenCreate({
      access_token,
      account_id,
      processor: 'moov'
    })
    const processor_token = processorResponse.data.processor_token
    console.log('Processor token created successfully')

    // Step 3: Link bank account to Moov using direct API calls
    console.log('Step 3: Linking bank account to Moov...')
    
    // Get Moov access token
    const moovAuthResponse = await fetch('https://api.moov.io/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${MOOV_PUBLIC_KEY}:${MOOV_SECRET_KEY}`)}`
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: `/accounts/${moov_account_id}/bank-accounts.write`
      })
    })

    const moovAuthData = await moovAuthResponse.json()
    console.log('Moov auth response status:', moovAuthResponse.status)
    
    if (!moovAuthResponse.ok) {
      console.error('Moov auth error:', JSON.stringify(moovAuthData))
      throw new Error(`Moov authentication failed: ${JSON.stringify(moovAuthData)}`)
    }

    const moovAccessToken = moovAuthData.access_token
    console.log('Moov access token obtained')

    // Link bank account using Plaid processor token
    const linkResponse = await fetch(`https://api.moov.io/accounts/${moov_account_id}/bank-accounts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${moovAccessToken}`,
        'X-Moov-Version': '2024.01.00'
      },
      body: JSON.stringify({
        plaid: {
          token: processor_token
        }
      })
    })

    const linkData = await linkResponse.json()
    console.log('Moov link response status:', linkResponse.status)
    
    if (!linkResponse.ok) {
      console.error('Moov link error:', JSON.stringify(linkData))
      throw new Error(`Moov bank account link failed: ${JSON.stringify(linkData)}`)
    }

    console.log('Bank account linked successfully!')
    console.log('Linked bank account ID:', linkData.bankAccountID)

    return new Response(JSON.stringify(linkData), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error: any) {
    console.error('Error in moov-plaid-link-account:', error.message)
    console.error('Error details:', error.response?.data || error)
    
    return new Response(
      JSON.stringify({
        error: error.response?.data || error.message || 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

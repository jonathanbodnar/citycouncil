// @ts-ignore - Deno std import
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-ignore - Deno npm import
import { PlaidApi, Configuration, PlaidEnvironments } from 'npm:plaid'
// @ts-ignore - Deno npm import
import { Moov } from 'npm:@moovio/sdk'

// @ts-ignore
const PLAID_CLIENT_ID = (globalThis as any).Deno?.env.get('PLAID_CLIENT_ID')
// @ts-ignore
const PLAID_SECRET = (globalThis as any).Deno?.env.get('PLAID_SECRET')
// @ts-ignore
const MOOV_PUBLIC_KEY = (globalThis as any).Deno?.env.get('MOOV_PUBLIC_KEY')
// @ts-ignore
const MOOV_SECRET_KEY = (globalThis as any).Deno?.env.get('MOOV_SECRET_KEY')
const MOOV_VERSION = 'v2024.01.00'

// Initialize Plaid client (same pattern as working plaid-create-link-token)
const plaidConfig = new Configuration({
  basePath: PlaidEnvironments.production,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': PLAID_CLIENT_ID!,
      'PLAID-SECRET': PLAID_SECRET!,
    },
  },
})
const plaidClient = new PlaidApi(plaidConfig)

// Initialize Moov client (same pattern as working moov-list-bank-accounts)
const moov = new Moov({
  xMoovVersion: MOOV_VERSION,
  security: { username: MOOV_PUBLIC_KEY, password: MOOV_SECRET_KEY }
})

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
    console.log('=== moov-plaid-link-account START ===')
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
    console.log('Request body:', JSON.stringify({
      public_token: body.public_token ? `${body.public_token.substring(0, 20)}...` : 'missing',
      account_id: body.account_id,
      moov_account_id: body.moov_account_id
    }))
    
    const { public_token, account_id, moov_account_id } = body
    
    if (!public_token || !account_id || !moov_account_id) {
      throw new Error(
        'public_token, account_id, and moov_account_id are required'
      )
    }

    // Step 1: Exchange Plaid public token for access token
    console.log('Step 1: Exchanging Plaid public token...')
    let access_token: string
    try {
      const exchangeResponse = await plaidClient.itemPublicTokenExchange({
        public_token
      })
      access_token = exchangeResponse.data.access_token
      console.log('Step 1 SUCCESS: Public token exchanged')
    } catch (plaidError: any) {
      console.error('Step 1 FAILED - Plaid exchange error:', plaidError?.response?.data || plaidError.message)
      throw new Error(`Plaid token exchange failed: ${plaidError?.response?.data?.error_message || plaidError.message}`)
    }

    // Step 2: Create processor token for Moov
    console.log('Step 2: Creating Plaid processor token for Moov...')
    let processor_token: string
    try {
      const processorResponse = await plaidClient.processorTokenCreate({
        access_token,
        account_id,
        processor: 'moov'
      })
      processor_token = processorResponse.data.processor_token
      console.log('Step 2 SUCCESS: Processor token created')
    } catch (plaidError: any) {
      console.error('Step 2 FAILED - Plaid processor error:', plaidError?.response?.data || plaidError.message)
      throw new Error(`Plaid processor token creation failed: ${plaidError?.response?.data?.error_message || plaidError.message}`)
    }

    // Step 3: Link bank account to Moov using SDK
    console.log('Step 3: Linking bank account to Moov...')
    let linkResult: any
    try {
      const response = await moov.bankAccounts.link({
        accountID: moov_account_id,
        linkBankAccount: {
          plaid: {
            token: processor_token
          }
        }
      })
      linkResult = (response as any)?.result || response
      console.log('Step 3 SUCCESS: Bank account linked')
      console.log('Link result:', JSON.stringify(linkResult))
    } catch (moovError: any) {
      console.error('Step 3 FAILED - Moov link error:', moovError.message)
      console.error('Moov error details:', moovError)
      throw new Error(`Moov bank account link failed: ${moovError.message}`)
    }

    console.log('=== moov-plaid-link-account SUCCESS ===')

    return new Response(JSON.stringify(linkResult), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error: any) {
    console.error('=== moov-plaid-link-account ERROR ===')
    console.error('Error message:', error.message)
    console.error('Error stack:', error.stack)
    
    return new Response(
      JSON.stringify({
        error: error.message || 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

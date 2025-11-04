// @ts-ignore - Deno std import
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-ignore - Deno npm import
import { PlaidApi, Configuration, PlaidEnvironments } from 'npm:plaid'

// Load secrets (should be set via Supabase Dashboard or CLI)
const PLAID_CLIENT_ID = '690a0403d4073e001d79578f'
// @ts-ignore
const PLAID_SECRET = 'f173024af98b655280539e90ad49c5'

const config = new Configuration({
  basePath: PlaidEnvironments.sandbox,
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
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { userId } = await req.json()
    if (!userId) throw new Error('User ID is required')

    const tokenRequest = {
      user: { client_user_id: userId },
      client_name: 'Your App Name',
      products: ['auth', 'transactions'],
      country_codes: ['US'],
      language: 'en',
    }

    const response = await plaidClient.linkTokenCreate(tokenRequest)

    return new Response(JSON.stringify(response.data), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error(
      'Plaid Link Token Error:',
      error.response ? error.response.data : error.message
    )

    return new Response(
      JSON.stringify({
        error: error?.response?.data || error?.message || 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

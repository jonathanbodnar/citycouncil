// @ts-ignore - Deno std import
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-ignore - Deno npm import
import { PlaidApi, Configuration, PlaidEnvironments } from 'npm:plaid'
// @ts-ignore - Deno npm import
import { Moov } from 'npm:@moovio/sdk'

const PLAID_CLIENT_ID = '690a0403d4073e001d79578f'
// @ts-ignore
const PLAID_SECRET = 'f173024af98b655280539e90ad49c5'
// @ts-ignore
const MOOV_PUBLIC_KEY = 'rEvCk_pOVqe5Pi73'
// @ts-ignore
const MOOV_SECRET_KEY = 'odUP-ZAPFaA1WMZqSh6ioi4qEeJBvn-z'
const MOOV_VERSION = 'v2024.01.00'

const plaidConfig = new Configuration({
  basePath: PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': PLAID_CLIENT_ID!,
      'PLAID-SECRET': PLAID_SECRET!
    }
  }
})
const plaidClient = new PlaidApi(plaidConfig)

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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { public_token, account_id, moov_account_id } = await req.json()
    if (!public_token || !account_id || !moov_account_id)
      throw new Error(
        'public_token, account_id, and moov_account_id are required'
      )

    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token
    })
    const access_token = exchangeResponse.data.access_token

    const processorResponse = await plaidClient.processorTokenCreate({
      access_token,
      account_id,
      processor: 'moov'
    })
    const processor_token = processorResponse.data.processor_token

    const moovResponse = await moov.bankAccounts.link({
      accountID: moov_account_id,
      linkBankAccount: {
        plaid: {
          token: processor_token 
        }
      }
    })

    return new Response(JSON.stringify(moovResponse), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error: any) {
    console.error(
      'Plaid Link Error:',
      error.response
        ? JSON.stringify(error.response.data, null, 2)
        : error.message
    )
    return new Response(
      JSON.stringify({
        error: error?.response?.data || error?.message || 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

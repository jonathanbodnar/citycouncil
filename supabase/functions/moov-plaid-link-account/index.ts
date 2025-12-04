// @ts-ignore - Deno std import
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

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
    // Get environment variables inside the handler
    const PLAID_CLIENT_ID = Deno.env.get('PLAID_CLIENT_ID')
    const PLAID_SECRET = Deno.env.get('PLAID_SECRET')
    const MOOV_PUBLIC_KEY = Deno.env.get('MOOV_PUBLIC_KEY')
    const MOOV_SECRET_KEY = Deno.env.get('MOOV_SECRET_KEY')

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

    const { public_token, account_id, moov_account_id } = await req.json()
    
    console.log('Request received:')
    console.log('- public_token:', public_token ? 'present' : 'missing')
    console.log('- account_id:', account_id)
    console.log('- moov_account_id:', moov_account_id)
    
    if (!public_token || !account_id || !moov_account_id) {
      throw new Error(
        'public_token, account_id, and moov_account_id are required'
      )
    }

    // Step 1: Exchange Plaid public token for access token
    console.log('Step 1: Exchanging Plaid public token...')
    const exchangeResponse = await fetch('https://production.plaid.com/item/public_token/exchange', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: PLAID_CLIENT_ID,
        secret: PLAID_SECRET,
        public_token: public_token
      })
    })

    const exchangeData = await exchangeResponse.json()
    console.log('Plaid exchange response status:', exchangeResponse.status)
    
    if (!exchangeResponse.ok) {
      console.error('Plaid exchange error:', exchangeData)
      throw new Error(`Plaid token exchange failed: ${exchangeData.error_message || JSON.stringify(exchangeData)}`)
    }

    const access_token = exchangeData.access_token
    console.log('Public token exchanged successfully')

    // Step 2: Create processor token for Moov
    console.log('Step 2: Creating Plaid processor token for Moov...')
    const processorResponse = await fetch('https://production.plaid.com/processor/token/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: PLAID_CLIENT_ID,
        secret: PLAID_SECRET,
        access_token: access_token,
        account_id: account_id,
        processor: 'moov'
      })
    })

    const processorData = await processorResponse.json()
    console.log('Plaid processor response status:', processorResponse.status)
    
    if (!processorResponse.ok) {
      console.error('Plaid processor error:', processorData)
      throw new Error(`Plaid processor token creation failed: ${processorData.error_message || JSON.stringify(processorData)}`)
    }

    const processor_token = processorData.processor_token
    console.log('Processor token created successfully')

    // Step 3: Link bank account to Moov using the processor token
    console.log('Step 3: Linking bank account to Moov...')
    
    // First, get Moov access token
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
      console.error('Moov auth error:', moovAuthData)
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
      console.error('Moov link error:', linkData)
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
    console.error('Full error:', error)
    
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

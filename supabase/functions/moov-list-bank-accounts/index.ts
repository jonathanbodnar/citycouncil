// @ts-ignore - Deno std import
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-ignore - Deno npm import
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

    // Initialize Moov client inside request handler
    const moov = new Moov({
      xMoovVersion: MOOV_VERSION,
      security: { username: MOOV_PUBLIC_KEY, password: MOOV_SECRET_KEY }
    })

    const { moovAccountId } = await req.json()
    console.log('Listing bank accounts for Moov account:', moovAccountId)

    if (!moovAccountId) {
      throw new Error('Missing moovAccountId in request body')
    }

    // Call Moov to LIST the bank accounts for that account
    const response = await moov.bankAccounts.list({accountID: moovAccountId})
    const bankAccounts = (response as any)?.result

    console.log('Moov list bank accounts response:', JSON.stringify(bankAccounts))

    if (!bankAccounts) {
      console.error('Moov list bank accounts unexpected response:', response)
      throw new Error('Failed to list bank accounts')
    }

    return new Response(JSON.stringify(bankAccounts), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error: any) {
    console.error('Moov List Bank Accounts Error:', error.message)
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

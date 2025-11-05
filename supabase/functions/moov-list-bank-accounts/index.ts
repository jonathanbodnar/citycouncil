// @ts-ignore - Deno std import
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-ignore - Deno npm import
import { Moov } from 'npm:@moovio/sdk'
// @ts-ignore - Deno ESM import

// Moov Secrets
// @ts-ignore
const MOOV_PUBLIC_KEY = (globalThis as any).Deno?.env.get('MOOV_PUBLIC_KEY')
// @ts-ignore
const MOOV_SECRET_KEY = (globalThis as any).Deno?.env.get('MOOV_SECRET_KEY')
const MOOV_VERSION = 'v2024.01.00'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type'
}

const moov = new Moov({
  xMoovVersion: MOOV_VERSION,
  security: { username: MOOV_PUBLIC_KEY, password: MOOV_SECRET_KEY }
})

serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { moovAccountId } = await req.json()

    if (!moovAccountId) {
      throw new Error('Missing moovAccountId in request body')
    }

    // 3. Call Moov to LIST the bank accounts for that account
    // This is the correct SDK method: `moov.accounts.listBankAccounts(accountID)`
    const response = await moov.bankAccounts.list({accountID:moovAccountId})
    const bankAccounts = (response as any)?.result

    if (!bankAccounts) {
      console.error('Moov list bank accounts unexpected response:', response)
      throw new Error('Failed to list bank accounts')
    }

    // 4. Return the list of bank accounts
    // The 'result' is already the array of bank accounts
    return new Response(JSON.stringify(bankAccounts), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error: any) {
    console.error('Moov List Bank Accounts Error:', error.message)
    return new Response(
      JSON.stringify({ error: error?.message || String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

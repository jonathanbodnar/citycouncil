// @ts-ignore - Deno std import for Supabase Edge Functions
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-ignore - Deno npm import is resolved at runtime in Edge Functions
import { Moov } from 'npm:@moovio/sdk'

// Read from Supabase secrets
// @ts-ignore - available at runtime in Edge Functions
const MOOV_PUBLIC_KEY = (globalThis as any).Deno?.env.get('MOOV_PUBLIC_KEY') || 'rEvCk_pOVqe5Pi73'
// @ts-ignore - available at runtime in Edge Functions
const MOOV_SECRET_KEY = (globalThis as any).Deno?.env.get('MOOV_SECRET_KEY') || 'odUP-ZAPFaA1WMZqSh6ioi4qEeJBvn-z'
const MOOV_VERSION = 'v2024.01.00'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload = await req.json()
    const { accountId, holderName, accountNumber, routingNumber, accountType } = payload

    if (!accountId || !holderName || !accountNumber || !routingNumber || !accountType) {
      throw new Error('Missing required fields: accountId, holderName, accountNumber, routingNumber, accountType')
    }

    const moov = new Moov({
      xMoovVersion: MOOV_VERSION,
      security: { username: MOOV_PUBLIC_KEY, password: MOOV_SECRET_KEY },
    })

    // ⭐ Payload structure based on official docs
    const bankAccountPayload = {
      holderName: holderName,
      holderType: 'individual',
      accountNumber: accountNumber,
      routingNumber: routingNumber,
      bankAccountType: accountType, // This matches the 'moov.js' docs
    }

    // ⭐ THE FINAL FIX: The method is `moov.accounts.link()`
    // The first argument is the accountID.
    // The second argument is an object that contains the bank account payload *and* the type.
    const response = await moov.accounts.link(accountId, {
      bankAccount: bankAccountPayload
    })
    
    const bankAccount = (response as any)?.result

    if (!bankAccount?.bankAccountID) {
      console.error('Moov add bank account unexpected response:', response)
      return new Response(JSON.stringify({ error: 'Failed to add bank account', details: response }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Success!
    return new Response(JSON.stringify(bankAccount), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    console.error('Moov Add Bank Account Error:', error.message)
    if (error.response) {
      console.error('Error Response Body:', await error.response.json().catch(() => 'no json body'))
    }
    return new Response(JSON.stringify({ error: error?.message || String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

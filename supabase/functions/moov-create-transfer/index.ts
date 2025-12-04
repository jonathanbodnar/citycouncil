// @ts-ignore - Deno std import for Supabase Edge Functions
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-ignore - Deno npm import is resolved at runtime in Edge Functions
import { Moov } from 'npm:@moovio/sdk'
// @ts-ignore - Deno ESM import for Supabase client in Edge Functions
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Read from Supabase secrets
// @ts-ignore - available at runtime in Edge Functions
const MOOV_PUBLIC_KEY = (globalThis as any).Deno?.env.get('MOOV_PUBLIC_KEY')
// @ts-ignore - available at runtime in Edge Functions
const MOOV_SECRET_KEY = (globalThis as any).Deno?.env.get('MOOV_SECRET_KEY')
// @ts-ignore - available at runtime in Edge Functions
const MOOV_FACILITATOR_ACCOUNT_ID = (globalThis as any).Deno?.env.get('MOOV_FACILITATOR_ACCOUNT_ID')
const MOOV_VERSION = 'v2024.01.00'

// Supabase env
// @ts-ignore - available at runtime in Edge Functions
const SUPABASE_URL = (globalThis as any).Deno?.env.get('SUPABASE_URL')
// @ts-ignore - available at runtime in Edge Functions
const SUPABASE_SERVICE_ROLE_KEY = (globalThis as any).Deno?.env.get('SUPABASE_SERVICE_ROLE_KEY')

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
    const payload = await req.json().catch(() => ({}))
    const { batchId, amount, destinationAccountId, description } = payload

    if (!batchId || !amount || !destinationAccountId) {
      throw new Error('Missing required fields: batchId, amount, destinationAccountId')
    }

    if (!MOOV_FACILITATOR_ACCOUNT_ID) {
      throw new Error('MOOV_FACILITATOR_ACCOUNT_ID not configured - this is your ShoutOut Moov account ID')
    }

    console.log('Creating Moov transfer:', {
      batchId,
      amount,
      destinationAccountId,
      facilitatorAccountId: MOOV_FACILITATOR_ACCOUNT_ID
    })

    const moov = new Moov({
      xMoovVersion: MOOV_VERSION,
      security: { username: MOOV_PUBLIC_KEY, password: MOOV_SECRET_KEY }
    })

    // Get the source (ShoutOut) account's bank account for ACH debit
    // This will auto-pull funds from our linked bank account
    const sourcePaymentMethods = await moov.paymentMethods.list({
      accountID: MOOV_FACILITATOR_ACCOUNT_ID
    })
    console.log('Source payment methods:', JSON.stringify(sourcePaymentMethods, null, 2))

    // Always use bank account (ACH debit) - this auto-pulls from our bank
    const sourceBankAccount = (sourcePaymentMethods as any)?.result?.find(
      (pm: any) => pm.paymentMethodType === 'ach-debit-fund'
    )
    
    if (!sourceBankAccount?.paymentMethodID) {
      throw new Error('No bank account linked to ShoutOut facilitator account for ACH debit. Please link a bank account in Moov dashboard.')
    }
    
    const sourcePaymentMethodId = sourceBankAccount.paymentMethodID
    console.log('Using bank account for ACH debit:', sourcePaymentMethodId)

    // Get destination (talent) account's bank account
    const destPaymentMethods = await moov.paymentMethods.list({
      accountID: destinationAccountId
    })
    console.log('Destination payment methods:', JSON.stringify(destPaymentMethods, null, 2))

    // Find their bank account as destination (ACH credit)
    const destBankAccount = (destPaymentMethods as any)?.result?.find(
      (pm: any) => pm.paymentMethodType === 'ach-credit-standard' || pm.paymentMethodType === 'ach-credit-same-day'
    )

    if (!destBankAccount?.paymentMethodID) {
      throw new Error('No valid bank account found for destination talent account. Have they linked their bank via Plaid?')
    }

    // Create the transfer
    const transferRequest = {
      source: {
        paymentMethodID: sourcePaymentMethodId
      },
      destination: {
        paymentMethodID: destBankAccount.paymentMethodID
      },
      amount: {
        currency: 'USD',
        value: Math.round(amount * 100) // Convert dollars to cents
      },
      description: description || `ShoutOut Payout - Batch ${batchId}`
    }

    console.log('Transfer request:', JSON.stringify(transferRequest, null, 2))

    const transferResponse = await moov.transfers.create({
      accountID: MOOV_FACILITATOR_ACCOUNT_ID,
      createTransfer: transferRequest
    })

    console.log('Transfer response:', JSON.stringify(transferResponse, null, 2))

    const transfer = (transferResponse as any)?.result

    if (!transfer?.transferID) {
      console.error('Unexpected transfer response:', transferResponse)
      throw new Error('Failed to create transfer - no transferID returned')
    }

    // Update the payout batch in the database
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
      
      const { error: updateError } = await supabase
        .from('payout_batches')
        .update({
          status: 'processing',
          moov_transfer_id: transfer.transferID,
          moov_transfer_status: transfer.status || 'pending',
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', batchId)

      if (updateError) {
        console.error('Failed to update payout batch:', updateError)
        // Don't throw - transfer was created successfully
      }

      // Also update individual payouts in this batch
      const { error: payoutsError } = await supabase
        .from('payouts')
        .update({
          status: 'processing',
          updated_at: new Date().toISOString()
        })
        .eq('batch_id', batchId)

      if (payoutsError) {
        console.error('Failed to update payouts:', payoutsError)
      }
    }

    return new Response(JSON.stringify({
      success: true,
      transferId: transfer.transferID,
      status: transfer.status,
      amount: amount,
      batchId: batchId
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('Moov Transfer Error:', error.message)
    if (error.response) {
      const errorBody = await error.response.json().catch(() => 'no json body')
      console.error('Error Response Body:', errorBody)
    }
    return new Response(
      JSON.stringify({ error: error?.message || String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})


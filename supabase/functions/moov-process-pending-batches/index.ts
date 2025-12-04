// @ts-ignore - Deno std import for Supabase Edge Functions
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-ignore - Deno npm import is resolved at runtime in Edge Functions
import { Moov } from 'npm:@moovio/sdk'
// @ts-ignore - Deno ESM import for Supabase client in Edge Functions
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Read from Supabase secrets
// @ts-ignore
const MOOV_PUBLIC_KEY = (globalThis as any).Deno?.env.get('MOOV_PUBLIC_KEY')
// @ts-ignore
const MOOV_SECRET_KEY = (globalThis as any).Deno?.env.get('MOOV_SECRET_KEY')
// @ts-ignore
const MOOV_FACILITATOR_ACCOUNT_ID = (globalThis as any).Deno?.env.get('MOOV_FACILITATOR_ACCOUNT_ID')
const MOOV_VERSION = 'v2024.01.00'

// Supabase env
// @ts-ignore
const SUPABASE_URL = (globalThis as any).Deno?.env.get('SUPABASE_URL')
// @ts-ignore
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
    const { talentId } = payload

    if (!talentId) {
      throw new Error('Missing required field: talentId')
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase configuration missing')
    }

    if (!MOOV_FACILITATOR_ACCOUNT_ID) {
      throw new Error('MOOV_FACILITATOR_ACCOUNT_ID not configured')
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Check if payouts are enabled globally
    const { data: settingsData } = await supabase
      .from('platform_settings')
      .select('setting_value')
      .eq('setting_key', 'payouts_enabled')
      .single()

    if (settingsData?.setting_value !== 'true') {
      return new Response(JSON.stringify({
        success: false,
        message: 'Payouts are currently disabled by admin'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get talent profile with Moov account ID
    const { data: talent, error: talentError } = await supabase
      .from('talent_profiles')
      .select('id, username, moov_account_id, bank_account_linked, payout_onboarding_completed')
      .eq('id', talentId)
      .single()

    if (talentError || !talent) {
      throw new Error('Talent not found')
    }

    if (!talent.moov_account_id) {
      throw new Error('Talent has not set up their Moov account')
    }

    if (!talent.bank_account_linked) {
      throw new Error('Talent has not linked their bank account')
    }

    if (!talent.payout_onboarding_completed) {
      throw new Error('Talent has not completed payout onboarding')
    }

    // Get all pending batches for this talent
    const { data: batches, error: batchesError } = await supabase
      .from('payout_batches')
      .select('*')
      .eq('talent_id', talentId)
      .eq('status', 'pending')
      .gt('net_payout_amount', 0)
      .order('week_start_date', { ascending: true })

    if (batchesError) {
      throw new Error(`Failed to fetch pending batches: ${batchesError.message}`)
    }

    if (!batches || batches.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No pending batches to process',
        processedCount: 0
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`Processing ${batches.length} pending batches for talent ${talent.username}`)

    const moov = new Moov({
      xMoovVersion: MOOV_VERSION,
      security: { username: MOOV_PUBLIC_KEY, password: MOOV_SECRET_KEY }
    })

    // Get source payment method (ShoutOut's wallet or bank)
    const sourcePaymentMethods = await moov.paymentMethods.list({
      accountID: MOOV_FACILITATOR_ACCOUNT_ID
    })

    const sourceWallet = (sourcePaymentMethods as any)?.result?.find(
      (pm: any) => pm.paymentMethodType === 'moov-wallet'
    )
    const sourceBankAccount = (sourcePaymentMethods as any)?.result?.find(
      (pm: any) => pm.paymentMethodType === 'ach-debit-fund'
    )
    
    const sourcePaymentMethodId = sourceWallet?.paymentMethodID || sourceBankAccount?.paymentMethodID
    
    if (!sourcePaymentMethodId) {
      throw new Error('No valid source payment method found for ShoutOut facilitator account')
    }

    // Get destination payment method (talent's bank account)
    const destPaymentMethods = await moov.paymentMethods.list({
      accountID: talent.moov_account_id
    })

    const destBankAccount = (destPaymentMethods as any)?.result?.find(
      (pm: any) => pm.paymentMethodType === 'ach-credit-standard' || pm.paymentMethodType === 'ach-credit-same-day'
    )

    if (!destBankAccount?.paymentMethodID) {
      throw new Error('No valid bank account found for talent. Bank may not be properly linked via Plaid.')
    }

    const results: any[] = []

    // Process each batch
    for (const batch of batches) {
      try {
        console.log(`Processing batch ${batch.id} for $${batch.net_payout_amount}`)

        const transferRequest = {
          source: {
            paymentMethodID: sourcePaymentMethodId
          },
          destination: {
            paymentMethodID: destBankAccount.paymentMethodID
          },
          amount: {
            currency: 'USD',
            value: Math.round(batch.net_payout_amount * 100) // Convert dollars to cents
          },
          description: `ShoutOut Payout - Week of ${batch.week_start_date}`
        }

        const transferResponse = await moov.transfers.create({
          accountID: MOOV_FACILITATOR_ACCOUNT_ID,
          createTransfer: transferRequest
        })

        const transfer = (transferResponse as any)?.result

        if (transfer?.transferID) {
          // Update batch status
          await supabase
            .from('payout_batches')
            .update({
              status: 'processing',
              moov_transfer_id: transfer.transferID,
              moov_transfer_status: transfer.status || 'pending',
              processed_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', batch.id)

          // Update individual payouts
          await supabase
            .from('payouts')
            .update({
              status: 'processing',
              updated_at: new Date().toISOString()
            })
            .eq('batch_id', batch.id)

          results.push({
            batchId: batch.id,
            amount: batch.net_payout_amount,
            transferId: transfer.transferID,
            status: 'success'
          })
        } else {
          throw new Error('No transferID returned')
        }

      } catch (batchError: any) {
        console.error(`Failed to process batch ${batch.id}:`, batchError.message)
        results.push({
          batchId: batch.id,
          amount: batch.net_payout_amount,
          status: 'failed',
          error: batchError.message
        })
      }
    }

    const successCount = results.filter(r => r.status === 'success').length
    const failCount = results.filter(r => r.status === 'failed').length

    return new Response(JSON.stringify({
      success: true,
      message: `Processed ${successCount} batches successfully, ${failCount} failed`,
      processedCount: successCount,
      failedCount: failCount,
      results
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('Process Pending Batches Error:', error.message)
    return new Response(
      JSON.stringify({ error: error?.message || String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})


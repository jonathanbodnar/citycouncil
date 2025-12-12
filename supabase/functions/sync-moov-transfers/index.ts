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
    if (!MOOV_FACILITATOR_ACCOUNT_ID) {
      throw new Error('MOOV_FACILITATOR_ACCOUNT_ID not configured')
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)
    
    // Get all payout batches that are in processing status
    const { data: pendingBatches, error: fetchError } = await supabase
      .from('payout_batches')
      .select('id, moov_transfer_id, moov_transfer_status, talent_id')
      .eq('status', 'processing')
      .not('moov_transfer_id', 'is', null)

    if (fetchError) {
      throw new Error(`Failed to fetch pending batches: ${fetchError.message}`)
    }

    if (!pendingBatches || pendingBatches.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No pending transfers to sync',
        updated: 0
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`Found ${pendingBatches.length} pending batches to sync`)

    const moov = new Moov({
      xMoovVersion: MOOV_VERSION,
      security: { username: MOOV_PUBLIC_KEY, password: MOOV_SECRET_KEY }
    })

    let updatedCount = 0
    const results: any[] = []

    for (const batch of pendingBatches) {
      try {
        // Get transfer status from Moov
        const transferResponse = await moov.transfers.get({
          accountID: MOOV_FACILITATOR_ACCOUNT_ID,
          transferID: batch.moov_transfer_id
        })

        const transfer = (transferResponse as any)?.result
        const moovStatus = transfer?.status

        console.log(`Batch ${batch.id}: Moov status = ${moovStatus}`)

        if (!moovStatus) {
          results.push({ batchId: batch.id, error: 'Could not get transfer status' })
          continue
        }

        // Map Moov status to our status
        // Moov statuses: created, pending, completed, failed, reversed
        let newStatus = batch.moov_transfer_status
        let batchStatus = 'processing'

        if (moovStatus === 'completed') {
          newStatus = 'completed'
          batchStatus = 'complete'
        } else if (moovStatus === 'failed' || moovStatus === 'reversed') {
          newStatus = moovStatus
          batchStatus = 'failed'
        } else if (moovStatus === 'pending' || moovStatus === 'created') {
          newStatus = 'pending'
          batchStatus = 'processing'
        }

        // Only update if status changed
        if (newStatus !== batch.moov_transfer_status) {
          const { error: updateError } = await supabase
            .from('payout_batches')
            .update({
              moov_transfer_status: newStatus,
              status: batchStatus,
              updated_at: new Date().toISOString()
            })
            .eq('id', batch.id)

          if (updateError) {
            console.error(`Failed to update batch ${batch.id}:`, updateError)
            results.push({ batchId: batch.id, error: updateError.message })
          } else {
            updatedCount++
            results.push({ batchId: batch.id, oldStatus: batch.moov_transfer_status, newStatus, batchStatus })

            // Also update individual payouts in this batch
            const payoutStatus = batchStatus === 'paid' ? 'processed' : (batchStatus === 'failed' ? 'failed' : 'processing')
            await supabase
              .from('payouts')
              .update({
                status: payoutStatus,
                processed_at: batchStatus === 'paid' ? new Date().toISOString() : null,
                updated_at: new Date().toISOString()
              })
              .eq('batch_id', batch.id)
          }
        } else {
          results.push({ batchId: batch.id, status: 'unchanged', moovStatus })
        }
      } catch (batchError: any) {
        console.error(`Error processing batch ${batch.id}:`, batchError)
        results.push({ batchId: batch.id, error: batchError.message })
      }
    }

    return new Response(JSON.stringify({
      success: true,
      totalPending: pendingBatches.length,
      updated: updatedCount,
      results
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('Sync Moov Transfers Error:', error.message)
    return new Response(
      JSON.stringify({ error: error?.message || String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})


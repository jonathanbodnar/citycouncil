/* global Deno */
export {};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;
// Supabase Edge Function: Process recurring payments for collab subscriptions
// This should be called by a cron job (pg_cron) to process due subscriptions
//
// It finds all active subscriptions with next_billing_date <= NOW()
// and charges them using their saved Fortis token
//
// Can be called with optional body: { subscription_id: string } to process a specific subscription
// Or with no body to process all due subscriptions

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const baseUrl = 'https://api.fortis.tech/v1';
const developerId = Deno.env.get('FORTIS_DEVELOPER_ID');
const userId = Deno.env.get('FORTIS_USER_ID');
const userApiKey = Deno.env.get('FORTIS_USER_API_KEY');
const locationId = Deno.env.get('FORTIS_LOCATION_ID');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

async function fortisFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'developer-id': developerId,
      'user-id': userId,
      'user-api-key': userApiKey,
      ...(init?.headers || {}),
    },
  });

  const body = await res.json().catch(() => ({}));
  
  if (!res.ok) {
    const detail = (body && (body.detail || body.message)) || 'Fortis request failed';
    throw new Error(detail);
  }
  return body;
}

// Calculate next billing date based on interval
function getNextBillingDate(interval: string, fromDate: Date = new Date()): Date {
  const next = new Date(fromDate);
  
  switch (interval) {
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'biweekly':
      next.setDate(next.getDate() + 14);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'quarterly':
      next.setMonth(next.getMonth() + 3);
      break;
    case 'yearly':
      next.setFullYear(next.getFullYear() + 1);
      break;
    default:
      next.setMonth(next.getMonth() + 1); // Default to monthly
  }
  
  return next;
}

async function processSubscription(
  supabase: any, 
  subscription: any
): Promise<{ success: boolean; error?: string; transaction_id?: string }> {
  const { id, fortis_token_id, amount_cents, recurring_interval, user_id, talent_id, service_offering_id } = subscription;
  
  console.log(`Processing subscription ${id}: amount=${amount_cents}, token=${fortis_token_id?.substring(0, 8)}...`);
  
  try {
    // Charge the saved card using the token
    // POST /v1/transactions/cc/sale
    const saleResult = await fortisFetch('/transactions/cc/sale', {
      method: 'POST',
      body: JSON.stringify({
        token_id: fortis_token_id, // Use saved card token
        transaction_amount: amount_cents,
        location_id: locationId,
        description: `Recurring collab subscription - ${subscription.company_name || 'Unknown'}`,
      }),
    });

    const transaction = saleResult?.data;
    
    if (!transaction) {
      throw new Error('No transaction data returned from Fortis');
    }

    // Check if approved
    const isApproved = transaction.status_code === 101 || transaction.status_id === 101;
    
    if (!isApproved) {
      // Payment failed
      const errorMsg = transaction.verbiage || transaction.reason_code || 'Payment declined';
      console.error(`Subscription ${id} payment failed:`, errorMsg);
      
      // Update subscription with failure info
      await supabase
        .from('collab_subscriptions')
        .update({
          failed_payments: subscription.failed_payments + 1,
          last_payment_status: 'failed',
          last_payment_error: errorMsg,
          // If 3+ failures, mark as failed status
          status: subscription.failed_payments >= 2 ? 'failed' : 'active',
        })
        .eq('id', id);
      
      return { success: false, error: errorMsg };
    }

    // Payment successful!
    console.log(`Subscription ${id} payment successful: transaction ${transaction.id}`);
    
    // Calculate next billing date
    const nextBillingDate = getNextBillingDate(recurring_interval);
    
    // Update subscription
    await supabase
      .from('collab_subscriptions')
      .update({
        successful_payments: subscription.successful_payments + 1,
        failed_payments: 0, // Reset failure count on success
        last_billing_date: new Date().toISOString(),
        next_billing_date: nextBillingDate.toISOString(),
        last_payment_status: 'success',
        last_payment_error: null,
      })
      .eq('id', id);

    // Create an order record for this recurring payment
    // Get talent info for admin fee
    const { data: talent } = await supabase
      .from('talent_profiles')
      .select('admin_fee_percentage, fulfillment_time_hours')
      .eq('id', talent_id)
      .single();

    const adminFeePercent = 15; // Fixed 15% admin fee for collabs
    const adminFee = Math.round(amount_cents * (adminFeePercent / 100));
    
    const fulfillmentDeadline = new Date();
    fulfillmentDeadline.setHours(fulfillmentDeadline.getHours() + (talent?.fulfillment_time_hours || 168));

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id,
        talent_id,
        service_offering_id,
        service_type: 'social_collab',
        amount: amount_cents,
        admin_fee: adminFee,
        status: 'pending',
        approval_status: 'approved',
        approved_at: new Date().toISOString(),
        is_corporate: true,
        is_corporate_order: true,
        company_name: subscription.company_name,
        suggested_script: subscription.suggested_script,
        target_audience: subscription.target_audience,
        customer_socials: subscription.customer_socials,
        request_details: `Recurring collab subscription payment #${subscription.successful_payments + 1}`,
        details_submitted: true,
        fulfillment_deadline: fulfillmentDeadline.toISOString(),
        payment_transaction_id: transaction.id,
      })
      .select()
      .single();

    if (orderError) {
      console.error('Failed to create order for recurring payment:', orderError);
    } else {
      console.log(`Created order ${order.id} for subscription ${id}`);
    }

    return { success: true, transaction_id: transaction.id };
    
  } catch (err: any) {
    console.error(`Error processing subscription ${id}:`, err);
    
    // Update subscription with error
    await supabase
      .from('collab_subscriptions')
      .update({
        failed_payments: subscription.failed_payments + 1,
        last_payment_status: 'error',
        last_payment_error: err.message,
        status: subscription.failed_payments >= 2 ? 'failed' : 'active',
      })
      .eq('id', id);
    
    return { success: false, error: err.message };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });
  }

  try {
    if (!developerId || !userId || !userApiKey || !locationId) {
      return new Response(JSON.stringify({
        error: 'Fortis credentials not configured',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({
        error: 'Supabase credentials not configured',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.json().catch(() => ({}));
    const { subscription_id } = payload;

    let subscriptions;

    if (subscription_id) {
      // Process specific subscription
      const { data, error } = await supabase
        .from('collab_subscriptions')
        .select('*')
        .eq('id', subscription_id)
        .eq('status', 'active')
        .single();

      if (error || !data) {
        return new Response(JSON.stringify({
          error: 'Subscription not found or not active',
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 });
      }

      subscriptions = [data];
    } else {
      // Find all due subscriptions
      const { data, error } = await supabase
        .from('collab_subscriptions')
        .select('*')
        .eq('status', 'active')
        .lte('next_billing_date', new Date().toISOString())
        .order('next_billing_date', { ascending: true })
        .limit(100); // Process max 100 at a time

      if (error) {
        throw error;
      }

      subscriptions = data || [];
    }

    console.log(`Processing ${subscriptions.length} subscriptions`);

    const results = {
      processed: 0,
      successful: 0,
      failed: 0,
      errors: [] as { subscription_id: string; error: string }[],
    };

    for (const subscription of subscriptions) {
      results.processed++;
      const result = await processSubscription(supabase, subscription);
      
      if (result.success) {
        results.successful++;
      } else {
        results.failed++;
        results.errors.push({
          subscription_id: subscription.id,
          error: result.error || 'Unknown error',
        });
      }
    }

    console.log(`Finished processing: ${results.successful} successful, ${results.failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        ...results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    );
  } catch (err: any) {
    console.error('Error in process-recurring-payments:', err);
    return new Response(JSON.stringify({ 
      success: false,
      error: err?.message || 'Unexpected error' 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

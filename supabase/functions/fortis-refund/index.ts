// Supabase Edge Function: Process Fortis refund
// Expects JSON body: { transaction_id: string, amount?: number, reason?: string }
// If amount not provided, full refund is processed

import { withRateLimit, RateLimitPresets } from '../_shared/rateLimiter.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const baseUrl = 'https://api.fortis.tech/v1';
const developerId = Deno.env.get('FORTIS_DEVELOPER_ID') ?? 'sfcRK525';
const userId = Deno.env.get('FORTIS_USER_ID') ?? '31f0ab8e8c8e1b708956086b';
const userApiKey = Deno.env.get('FORTIS_USER_API_KEY') ?? '11f0b9ad16fa333aaa494a9d';

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
    throw new Error(`Fortis API Error: ${detail}`);
  }
  return body;
}

Deno.serve(withRateLimit(async (req) => {
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
    // Parse request body
    const { transaction_id, amount, reason } = await req.json();
    
    if (!transaction_id || typeof transaction_id !== 'string') {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'transaction_id is required' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Get original transaction details first
    console.log(`Fetching transaction ${transaction_id} for refund`);
    const transactionResponse = await fortisFetch(`/transactions/${transaction_id}`, { 
      method: 'GET' 
    });
    
    const transaction = transactionResponse?.data;
    if (!transaction) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Transaction not found' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    // Determine refund amount (full refund if not specified)
    const refundAmount = amount || transaction.transaction_amount;
    
    console.log(`Processing refund of ${refundAmount} cents for transaction ${transaction_id}`);

    // Process refund via Fortis API
    const refundResponse = await fortisFetch(`/transactions/${transaction_id}/refund`, {
      method: 'POST',
      body: JSON.stringify({
        transaction_amount: refundAmount,
        reason: reason || 'Order cancelled/denied',
      }),
    });

    const refundData = refundResponse?.data;
    
    if (!refundData || !refundData.id) {
      throw new Error('Refund failed - no refund ID returned');
    }

    console.log(`Refund successful: ${refundData.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        refund_id: refundData.id,
        refund_amount: refundAmount,
        original_amount: transaction.transaction_amount,
        status: refundData.status_code,
        transaction_id: transaction_id,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 200 
      },
    );

  } catch (err: any) {
    console.error('Refund error:', err);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: err?.message || 'Unexpected error processing refund' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
}, RateLimitPresets.PAYMENT, { keyPrefix: 'refund' }));


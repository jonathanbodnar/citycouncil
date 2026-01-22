/* global Deno */
export {};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;
// Supabase Edge Function: Process a Fortis ticket sale
// After collecting card data via ticket intention, this function charges the card
// and saves it as a token for future recurring charges
//
// Expects JSON body: { 
//   ticket_id: string,       // From Commerce.js submit() result
//   amount_cents: number,    // Amount to charge
//   save_account: boolean    // Whether to save card for recurring (should be true)
// }
// Returns: { 
//   success: boolean,
//   transaction_id: string,
//   token_id: string,        // Use this for future recurring charges
//   account_vault_id: string // Alternative identifier for saved card
// }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { withRateLimit, RateLimitPresets } from '../_shared/rateLimiter.ts';

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
  console.log(`Fortis API call: ${init?.method || 'GET'} ${path}`);
  
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
  
  console.log(`Fortis API response: ${res.status}`, JSON.stringify(body).substring(0, 500));
  
  if (!res.ok) {
    const detail = (body && (body.detail || body.message)) || 'Fortis request failed';
    throw new Error(detail);
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
    if (!developerId || !userId || !userApiKey || !locationId) {
      return new Response(JSON.stringify({
        error: 'Fortis credentials not configured',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
    }

    const payload = await req.json().catch(() => ({}));
    const { ticket_id, amount_cents, save_account = true } = payload;

    if (!ticket_id) {
      return new Response(JSON.stringify({ error: 'ticket_id is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    if (!Number.isFinite(amount_cents) || amount_cents <= 0) {
      return new Response(JSON.stringify({ error: 'amount_cents must be a positive number' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    console.log(`Processing ticket sale: ticket_id=${ticket_id}, amount=${amount_cents}, save=${save_account}`);

    // Process the ticket sale - this charges the card and optionally saves it
    // POST /v1/transactions/cc/sale/ticket
    const saleResult = await fortisFetch('/transactions/cc/sale/ticket', {
      method: 'POST',
      body: JSON.stringify({
        ticket: ticket_id,
        transaction_amount: amount_cents,
        location_id: locationId,
        save_account: save_account, // This creates a token for recurring charges
        // Additional fields that can be set:
        // billing_address, order_number, description, etc.
      }),
    });

    const transaction = saleResult?.data;
    
    if (!transaction) {
      throw new Error('No transaction data returned from Fortis');
    }

    // Check if transaction was successful
    // status_code 101 = approved, reason_code_id 1000 = approved
    const isApproved = transaction.status_code === 101 || transaction.status_id === 101;
    
    if (!isApproved) {
      console.error('Transaction not approved:', transaction);
      return new Response(JSON.stringify({
        success: false,
        error: transaction.verbiage || transaction.reason_code || 'Payment declined',
        status_code: transaction.status_code,
        reason_code_id: transaction.reason_code_id,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    console.log('Transaction approved:', transaction.id);

    // Extract the token_id for future recurring charges
    // This is saved automatically when save_account=true
    const tokenId = transaction.token_id || transaction.account_vault_id;
    const accountVaultId = transaction.account_vault_id;

    return new Response(
      JSON.stringify({
        success: true,
        transaction_id: transaction.id,
        token_id: tokenId,
        account_vault_id: accountVaultId,
        amount_cents: amount_cents,
        last_four: transaction.last_four,
        card_type: transaction.account_type,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    );
  } catch (err: any) {
    console.error('Error processing ticket sale:', err);
    return new Response(JSON.stringify({ 
      success: false,
      error: err?.message || 'Unexpected error' 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
}, RateLimitPresets.PAYMENT, { keyPrefix: 'ticket-process' }));

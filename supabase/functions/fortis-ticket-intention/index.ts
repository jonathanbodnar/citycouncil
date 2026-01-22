/* global Deno, crypto */
export {};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;
// Supabase Edge Function: Create Fortis ticket intention for recurring payments
// Unlike transaction intention, ticket intention does NOT process payment immediately
// It returns a ticket_id which is used to save the card for recurring charges
//
// Expects JSON body: { }  (no amount needed - just collecting card data)
// Returns: { clientToken, locationId, environment, intentionType: 'ticket' }

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
    throw new Response(JSON.stringify({ error: detail, status: res.status, body }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 502,
    });
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

    // Ticket intention doesn't need amount - just collecting card data
    // The amount will be specified when processing the ticket sale
    
    const body = await fortisFetch('/elements/ticket/intention', {
      method: 'POST',
      body: JSON.stringify({
        location_id: locationId,
        // No action or amount needed for ticket intention
        // This just creates a session to collect and tokenize card data
      }),
    });

    const clientToken = body?.data?.client_token;
    const env = body?.environment || 'sandbox';
    const returnedLocationId = body?.data?.location_id || locationId;

    return new Response(
      JSON.stringify({
        clientToken,
        environment: env,
        locationId: returnedLocationId,
        intentionType: 'ticket', // Important: frontend needs to know this is ticket flow
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    );
  } catch (err: any) {
    if (err instanceof Response) return err;
    return new Response(JSON.stringify({ error: err?.message || 'Unexpected error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
}, RateLimitPresets.PAYMENT, { keyPrefix: 'ticket-payment' }));

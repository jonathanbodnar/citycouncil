/* global Deno, crypto */
export {};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;
// Supabase Edge Function: Create Fortis transaction intention
// Expects JSON body: { amount_cents: number }
// Returns: { clientToken, locationId, amount, orderReference, environment }

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

function randomOrderReference() {
  // Simple unique order reference for linkage; prefer backend DB in production
  const uuid = crypto.randomUUID();
  return `ORDER-${uuid}`;
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
    const amountCents = Number(payload?.amount_cents);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return new Response(JSON.stringify({ error: 'amount_cents must be a positive number' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const orderReference = randomOrderReference();

    const body = await fortisFetch('/elements/transaction/intention', {
      method: 'POST',
      body: JSON.stringify({
        action: 'sale',
        amount: amountCents,
        location_id: locationId,
        save_account: false,
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
        amount: amountCents,
        orderReference,
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
}, RateLimitPresets.PAYMENT, { keyPrefix: 'payment' }));



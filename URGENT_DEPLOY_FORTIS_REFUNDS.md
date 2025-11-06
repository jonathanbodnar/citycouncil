# 🚨 URGENT: Deploy Fixed Fortis Refunds Function

## Current Error:
```
POST https://...supabase.co/functions/v1/fortis-refunds 500 (Internal Server Error)
Error: Edge Function returned a non-2xx status code
```

## Problem:
The deployed `fortis-refunds` Edge Function in Supabase still has the old broken code with `withRateLimit` import that doesn't work.

## Solution:
**Manually update the function in Supabase Dashboard** (takes 2 minutes)

---

## 🔥 Quick Deploy Steps:

### 1. Open Supabase Dashboard
Go to: https://supabase.com/dashboard/project/utafetamgwukkbrlezev/functions/fortis-refunds/details

### 2. Click "Edit Function"
(Big button on the right side)

### 3. Delete ALL existing code and paste this:

```typescript
// Supabase Edge Function: Process Fortis refund
// Expects JSON body: { transaction_id: string, amount?: number, reason?: string }
// If amount not provided, full refund is processed

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const baseUrl = 'https://api.fortis.tech/v1';
const developerId = Deno.env.get('FORTIS_DEVELOPER_ID');
const userId = Deno.env.get('FORTIS_USER_ID');
const userApiKey = Deno.env.get('FORTIS_USER_API_KEY');

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
    // Validate environment variables
    if (!developerId || !userId || !userApiKey) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Fortis credentials not configured'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

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
});
```

### 4. Click "Deploy" (bottom right)

### 5. Wait 10 seconds for deployment

### 6. Test the refund again!

---

## ✅ What This Does:

- ✅ Removes broken `withRateLimit` import
- ✅ Removes broken `createClient` import  
- ✅ Keeps all CORS headers
- ✅ Keeps all Fortis refund logic
- ✅ Keeps all error handling

## 🔒 Environment Variables:

Make sure these are set in the function's "Secrets" tab:
- `FORTIS_DEVELOPER_ID`
- `FORTIS_USER_ID`
- `FORTIS_USER_API_KEY`

---

## 🧪 After Deployment:

1. Go back to Admin Dashboard > Orders Management
2. Click "Refund" on a completed order
3. Enter reason and click "Process Refund"
4. Should work! ✅

---

## Why Manual Deployment?

Supabase Edge Functions don't auto-deploy from Git. They must be deployed via:
- Supabase Dashboard (easiest)
- Supabase CLI (requires setup)
- CI/CD pipeline (not configured)

---

**This should take 2 minutes total!** 🚀


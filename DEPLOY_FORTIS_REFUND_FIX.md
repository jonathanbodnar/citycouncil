# Deploy Fortis Refund Edge Function - CORS Fix

## Problem
The `fortis-refund` Edge Function is failing with CORS errors because it's trying to import `withRateLimit` from a shared module that doesn't exist in the deployment.

## Solution
Deploy the function **without rate limiting** to fix CORS issues.

---

## 📋 Deployment Steps

### 1. Go to Supabase Dashboard
- Navigate to: https://supabase.com/dashboard/project/utafetamgwukkbrlezev
- Click **Edge Functions** in the left sidebar
- Find `fortis-refunds` function (note: plural)

### 2. Update the Function Code
Click **Edit** and replace ALL code with the following:

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

### 3. Verify Environment Variables
Make sure these secrets are set in the Supabase Dashboard under **Edge Functions > fortis-refunds > Secrets**:

- `FORTIS_DEVELOPER_ID`
- `FORTIS_USER_ID`
- `FORTIS_USER_API_KEY`

### 4. Deploy
Click **Deploy** button in the Supabase Dashboard.

### 5. Test
Try processing a refund from the Orders Management page in your admin dashboard.

---

## ✅ What This Fixes

1. **CORS Error**: Removed `withRateLimit` import that was causing module resolution failures
2. **Deployment**: Function now has zero external dependencies
3. **Functionality**: All refund logic remains intact

## 📝 Changes Made

- ❌ Removed: `import { withRateLimit, RateLimitPresets } from '../_shared/rateLimiter.ts';`
- ❌ Removed: `import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';` (unused)
- ❌ Removed: `withRateLimit()` wrapper around `Deno.serve()`
- ✅ Kept: All CORS headers
- ✅ Kept: All Fortis refund logic
- ✅ Kept: Error handling and validation

## 🔒 Security Note

Rate limiting was removed to fix deployment. Consider implementing rate limiting at the database/application level if needed for production.

---

## 🧪 Testing

After deployment, test refunds:

1. Go to Admin Dashboard > Orders Management
2. Click "Refund" on a completed order
3. Enter a reason and click "Process Refund"
4. Should succeed without CORS errors ✅

---

**File:** `supabase/functions/fortis-refunds/index.ts` (note: plural)


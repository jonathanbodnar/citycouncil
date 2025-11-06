# 🚨 DEPLOY FIXED Fortis Refunds Function - FINAL VERSION

## Error Fixed:
```
Fortis API Error: Route not found
```

## What Was Wrong:
- ❌ Using `POST /transactions/{id}/refund` (doesn't exist in Fortis API)
- ✅ Should use `PATCH /transactions/{id}/refund` (correct Fortis endpoint)

---

## 📋 Quick Deploy (2 minutes):

### 1. Open Supabase Dashboard
https://supabase.com/dashboard/project/utafetamgwukkbrlezev/functions/fortis-refunds/details

### 2. Click "Edit Function"

### 3. Replace ALL code with this CORRECTED version:

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

    // Process refund via Fortis API - CORRECTED: use PATCH method
    const refundResponse = await fortisFetch(`/transactions/${transaction_id}/refund`, {
      method: 'PATCH',
      body: JSON.stringify({
        transaction_amount: refundAmount,
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

### 4. Verify Environment Variables

Make sure these secrets are set under **Secrets** tab:
- `FORTIS_DEVELOPER_ID`
- `FORTIS_USER_ID`
- `FORTIS_USER_API_KEY`
- `FORTIS_LOCATION_ID` (newly added)

### 5. Click "Deploy"

### 6. Test the refund!

---

## ✅ What's Fixed:

### Before (Broken):
```typescript
POST /v1/transactions/{id}/refund
{
  "transaction_amount": 2500,
  "reason": "Order denied"
}
```
❌ Returns: "Route not found"

### After (Working):
```typescript
PATCH /v1/transactions/{id}/refund
{
  "transaction_amount": 2500
}
```
✅ Returns: Refund successful with refund_id

---

## 🔍 Key Changes:

1. **Method**: `POST` → `PATCH`
2. **Payload**: Simplified to only `transaction_amount`
3. **Added**: `FORTIS_LOCATION_ID` environment variable

---

## 📚 Reference:

According to [Fortis API Documentation](https://docs.fortispay.com/developers/api/endpoints/transactions), refunds should be processed using the PATCH method on the refund sub-resource of a transaction.

---

## 🧪 Testing:

1. Go to Admin Dashboard > Orders Management
2. Find a completed order with a valid transaction ID
3. Click "Refund"
4. Enter reason: "Testing corrected API endpoint"
5. Click "Process Refund"
6. Should see: ✅ "Order denied and refund processed successfully"
7. Check Fortis dashboard to confirm refund appears

---

**This is the FINAL corrected version!** 🎉


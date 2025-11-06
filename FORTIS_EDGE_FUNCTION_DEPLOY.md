# Deploy Fortis Refund Edge Function (Supabase Dashboard)

## 🔐 **IMPORTANT: Environment Variables First!**

Before deploying, make sure your Fortis credentials are set as Supabase secrets:

1. Go to **Supabase Dashboard** → **Project Settings** → **Edge Functions**
2. Scroll to **"Secrets"**
3. Add these variables (get values from your Fortis account):
   - `FORTIS_DEVELOPER_ID`
   - `FORTIS_USER_ID`
   - `FORTIS_USER_API_KEY`
   - `FORTIS_LOCATION_ID`

---

## 📋 **Deployment Steps**

### **Step 1: Create Function**

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select project: **utafetamgwukkbrlezev**
3. Click **"Edge Functions"** in sidebar
4. Click **"Create a new function"**
5. Name: `fortis-refund`
6. Click **"Create"**

---

### **Step 2: Paste This Code**

Replace the default code with this (NO hardcoded credentials):

```typescript
// Supabase Edge Function: Process Fortis refund
// Expects JSON body: { transaction_id: string, amount?: number, reason?: string }

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
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  // Only allow POST requests
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
    
    // Validate transaction_id
    if (!transaction_id || typeof transaction_id !== 'string') {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'transaction_id is required' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Get original transaction details
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

    // Return success response
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

---

### **Step 3: Deploy**

1. Click **"Save"** or **"Deploy"** button
2. Wait 10-30 seconds for deployment
3. Should see: ✅ **"Function deployed successfully"**

---

### **Step 4: Verify**

1. Go to **Edge Functions** → **fortis-refund**
2. Status should show **"Active"**
3. Try a test request (optional)

---

## ✅ **Done!**

Your refund function is now live at:
```
https://utafetamgwukkbrlezev.supabase.co/functions/v1/fortis-refund
```

The frontend will automatically use this endpoint when processing refunds.

---

## 🔒 **Security Notes**

- ✅ NO hardcoded credentials in code
- ✅ All credentials via environment variables
- ✅ Validates credentials before processing
- ✅ Returns 500 error if credentials missing
- ✅ Full error logging for debugging


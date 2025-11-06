# 🔒 SECURE Deployment: moov-plaid-link-account

## ⚠️ CRITICAL: Your credentials were exposed in the Edge Function!

**DO NOT** paste credentials directly in the code. Always use environment variables.

---

## 🔐 Step 1: Rotate Your Credentials (IMPORTANT!)

Since these were exposed, you should rotate them:

### Plaid:
1. Go to https://dashboard.plaid.com/team/keys
2. Click **"Rotate secret"** for your Production secret
3. Copy the NEW secret

### Moov:
1. Go to https://dashboard.moov.io/
2. Navigate to **API Keys** or **Settings**
3. **Delete** the old key: `rEvCk_pOVqe5Pi73`
4. **Create** a new key pair
5. Copy the NEW public and secret keys

---

## 📋 Step 2: Deploy This SECURE Code

Go to **Supabase Dashboard** → **Edge Functions** → `moov-plaid-link-account`

Paste this code:

```typescript
// @ts-ignore - Deno std import
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// @ts-ignore - Deno npm import
import { PlaidApi, Configuration, PlaidEnvironments } from 'npm:plaid';
// @ts-ignore - Deno npm import
import { Moov } from 'npm:@moovio/sdk';

// Read from environment variables (set in Supabase Dashboard)
// @ts-ignore
const PLAID_CLIENT_ID = (globalThis as any).Deno?.env.get('PLAID_CLIENT_ID');
// @ts-ignore
const PLAID_SECRET = (globalThis as any).Deno?.env.get('PLAID_SECRET');
// @ts-ignore
const MOOV_PUBLIC_KEY = (globalThis as any).Deno?.env.get('MOOV_PUBLIC_KEY');
// @ts-ignore
const MOOV_SECRET_KEY = (globalThis as any).Deno?.env.get('MOOV_SECRET_KEY');

const MOOV_VERSION = 'v2024.01.00';

// Validate required environment variables
if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
  throw new Error('PLAID_CLIENT_ID and PLAID_SECRET must be set in Edge Function secrets');
}
if (!MOOV_PUBLIC_KEY || !MOOV_SECRET_KEY) {
  throw new Error('MOOV_PUBLIC_KEY and MOOV_SECRET_KEY must be set in Edge Function secrets');
}

const plaidConfig = new Configuration({
  basePath: PlaidEnvironments.production, // ✅ PRODUCTION
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': PLAID_CLIENT_ID,
      'PLAID-SECRET': PLAID_SECRET
    }
  }
});

const plaidClient = new PlaidApi(plaidConfig);

const moov = new Moov({
  xMoovVersion: MOOV_VERSION,
  security: {
    username: MOOV_PUBLIC_KEY,
    password: MOOV_SECRET_KEY
  }
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }

  try {
    const { public_token, account_id, moov_account_id } = await req.json();
    
    if (!public_token || !account_id || !moov_account_id) {
      throw new Error('public_token, account_id, and moov_account_id are required');
    }

    // Step 1: Exchange public token for access token
    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token
    });
    const access_token = exchangeResponse.data.access_token;

    // Step 2: Create processor token for Moov
    const processorResponse = await plaidClient.processorTokenCreate({
      access_token,
      account_id,
      processor: 'moov'
    });
    const processor_token = processorResponse.data.processor_token;

    // Step 3: Link bank account to Moov account
    const moovResponse = await moov.bankAccounts.link({
      accountID: moov_account_id,
      linkBankAccount: {
        plaid: {
          token: processor_token
        }
      }
    });

    return new Response(JSON.stringify(moovResponse), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error: any) {
    console.error('Plaid Link Error:', error.response 
      ? JSON.stringify(error.response.data, null, 2) 
      : error.message
    );
    
    return new Response(JSON.stringify({
      error: error?.response?.data || error?.message || 'Unknown error'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
```

---

## 🔑 Step 3: Add Secrets in Supabase Dashboard

In the Edge Function **Secrets** section (NOT in the code):

### Add these 4 secrets:

1. **PLAID_CLIENT_ID**
   - Value: `690a0403d4073e001d79578f` (your Production client ID)

2. **PLAID_SECRET**
   - Value: `[YOUR_NEW_ROTATED_SECRET]` (get this from Step 1)

3. **MOOV_PUBLIC_KEY**
   - Value: `[YOUR_NEW_PUBLIC_KEY]` (get this from Step 1)

4. **MOOV_SECRET_KEY**
   - Value: `[YOUR_NEW_SECRET_KEY]` (get this from Step 1)

---

## ✅ Step 4: Test It

1. Log in as a talent
2. Go to **Payouts** tab
3. Click **"Connect Bank Account"**
4. Complete the Plaid Link flow
5. Bank account should link successfully ✅

---

## 🔍 Key Changes Made:

| Before (INSECURE ❌) | After (SECURE ✅) |
|---------------------|------------------|
| `const PLAID_SECRET = 'f173024af98b655280539e90ad49c5'` | `const PLAID_SECRET = Deno.env.get('PLAID_SECRET')` |
| `const MOOV_PUBLIC_KEY = 'rEvCk_pOVqe5Pi73'` | `const MOOV_PUBLIC_KEY = Deno.env.get('MOOV_PUBLIC_KEY')` |
| `PlaidEnvironments.sandbox` | `PlaidEnvironments.production` |
| No validation | ✅ Validates env vars exist |

---

## 🚨 Security Best Practices:

1. ✅ **NEVER** hardcode credentials in code
2. ✅ **ALWAYS** use environment variables (`Deno.env.get()`)
3. ✅ **ROTATE** credentials if they're exposed
4. ✅ **DELETE** this guide after deployment
5. ✅ **CHECK** git history doesn't contain credentials

---

## 📝 After Deployment Checklist:

- [ ] Rotated Plaid secret
- [ ] Rotated Moov keys
- [ ] Deployed secure code
- [ ] Added all 4 secrets in Supabase
- [ ] Tested Plaid Link flow
- [ ] Verified bank account links successfully
- [ ] Deleted this guide

---

**⚠️ Remember: Credentials in code = Security vulnerability**

Always use Supabase Edge Function **Secrets** for sensitive data! 🔐


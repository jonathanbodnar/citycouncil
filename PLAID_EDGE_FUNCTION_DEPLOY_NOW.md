# 🚨 DEPLOY PLAID EDGE FUNCTION NOW

## The Problem:
Plaid Link is failing with 500 errors because the `plaid-create-link-token` Edge Function hasn't been updated yet.

## 🔥 IMMEDIATE FIX - Deploy via Supabase Dashboard:

### Step 1: Go to Supabase Dashboard
1. Open: https://supabase.com/dashboard/project/utafetamgwukkbrlezev
2. Click **"Edge Functions"** in the left sidebar

### Step 2: Find and Edit the Function
1. Find `plaid-create-link-token` in the list
2. Click on it to open
3. Click **"Edit"** or **"Deploy new version"**

### Step 3: Replace ALL Code
**Delete everything** in the editor and paste this:

```typescript
// @ts-ignore - Deno std import
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-ignore - Deno npm import
import { PlaidApi, Configuration, PlaidEnvironments } from 'npm:plaid'
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Load secrets (should be set via Supabase Dashboard or CLI)
// @ts-ignore
const PLAID_CLIENT_ID = (globalThis as any).Deno?.env.get('PLAID_CLIENT_ID')
// @ts-ignore
const PLAID_SECRET = (globalThis as any).Deno?.env.get('PLAID_SECRET')
// @ts-ignore
const SUPABASE_URL = (globalThis as any).Deno?.env.get('SUPABASE_URL')
// @ts-ignore
const SUPABASE_SERVICE_ROLE_KEY = (globalThis as any).Deno?.env.get('SUPABASE_SERVICE_ROLE_KEY')

const config = new Configuration({
  basePath: PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': PLAID_CLIENT_ID!,
      'PLAID-SECRET': PLAID_SECRET!,
    },
  },
})

const plaidClient = new PlaidApi(config)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { userId } = await req.json()
    if (!userId) throw new Error('User ID is required')

    // Get user data from Supabase
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)
    
    const { data: authUser } = await supabase.auth.admin.getUserById(userId)
    const { data: userData } = await supabase
      .from('users')
      .select('phone')
      .eq('id', userId)
      .maybeSingle()
    
    const { data: talentProfile } = await supabase
      .from('talent_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    // Format phone number for Plaid (remove all non-digits, ensure 10 digits)
    let phoneNumber = null
    if (userData?.phone) {
      const cleaned = userData.phone.replace(/\D/g, '')
      // Remove country code if present
      const digits = cleaned.startsWith('1') && cleaned.length === 11 ? cleaned.slice(1) : cleaned
      // Only use if exactly 10 digits
      if (digits.length === 10) {
        phoneNumber = digits
      }
    }

    // Parse full name
    let givenName = ''
    let familyName = ''
    if (talentProfile?.full_name) {
      const nameParts = talentProfile.full_name.trim().split(' ')
      givenName = nameParts[0] || ''
      familyName = nameParts.slice(1).join(' ') || ''
    }

    const tokenRequest: any = {
      user: { 
        client_user_id: userId,
      },
      client_name: 'ShoutOut',
      products: ['auth'],
      country_codes: ['US'],
      language: 'en',
    }

    // Only add user data if we have valid information
    if (authUser?.email || phoneNumber || (givenName && familyName)) {
      tokenRequest.user.email_address = authUser?.email || undefined
      tokenRequest.user.phone_number = phoneNumber || undefined
      
      if (givenName && familyName) {
        tokenRequest.user.name = {
          given_name: givenName,
          family_name: familyName,
        }
      }
    }

    console.log('Creating Plaid link token with user data:', {
      userId,
      email: authUser?.email || 'none',
      phone: phoneNumber || 'none',
      name: `${givenName} ${familyName}`.trim() || 'none'
    })

    const response = await plaidClient.linkTokenCreate(tokenRequest)

    return new Response(JSON.stringify(response.data), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error(
      'Plaid Link Token Error:',
      error.response ? error.response.data : error.message
    )

    return new Response(
      JSON.stringify({
        error: error?.response?.data || error?.message || 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
```

### Step 4: Deploy
Click **"Deploy"** or **"Save"** button

### Step 5: Test
1. Go back to your Payouts tab
2. Click "Link Bank via Plaid"
3. Should open successfully now!

---

## What This Fixes:
✅ Plaid phone number validation errors
✅ 500 Internal Server Errors
✅ Pre-fills user data (name, email, phone)

## Why This Happened:
The code was pushed to GitHub but Edge Functions don't auto-deploy from git. They must be deployed manually via:
- Supabase Dashboard (easiest)
- Supabase CLI: `supabase functions deploy plaid-create-link-token`

---

**DO THIS NOW** to fix Plaid! 🚀


# 🚨 URGENT: Deploy Plaid Phone Fix

## Problem:
Plaid Link popup showing **"Something went wrong - Internal error occurred"**

Console error: `Unable to parse phone number: TOO_SHORT`

## Root Cause:
The Edge Function `plaid-create-link-token` was sending invalid/short phone numbers to Plaid, even when validation should have caught it.

---

## ✅ Solution: Deploy Updated Edge Function

### **Step 1: Go to Supabase Dashboard**
https://supabase.com/dashboard/project/utafetamgwukkbrlezev/functions

### **Step 2: Click on `plaid-create-link-token`**

### **Step 3: Replace the ENTIRE code with this:**

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
  basePath: PlaidEnvironments.production,
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
    // IMPORTANT: Only send email/phone/name if they are valid, otherwise omit them entirely
    if (authUser?.email) {
      tokenRequest.user.email_address = authUser.email
    }
    
    // Only send phone if it's EXACTLY 10 digits (Plaid requirement)
    if (phoneNumber && phoneNumber.length === 10) {
      tokenRequest.user.phone_number = phoneNumber
    }
    
    // Only send name if both parts exist
    if (givenName && familyName) {
      tokenRequest.user.name = {
        given_name: givenName,
        family_name: familyName,
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

### **Step 4: Click "Deploy"**

### **Step 5: Verify Secrets are Set**
Make sure these environment variables are configured (in the function's **Secrets** tab):
- `PLAID_CLIENT_ID` = `690a0403d4073e001d79578f` (your production client ID)
- `PLAID_SECRET` = `[your NEW rotated production secret]`
- `SUPABASE_URL` = `https://utafetamgwukkbrlezev.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` = `[your service role key]`

---

## ✅ Test After Deployment:

1. Refresh your app (hard refresh: `Cmd+Shift+R`)
2. Go to **Payouts** tab as a talent user
3. Click **"Connect Bank Account"**
4. Plaid Link should open ✅
5. No more "Something went wrong" error ✅

---

## 🔍 What Changed:

**Lines 93-108**: Now validates phone BEFORE sending to Plaid

**Before:**
```javascript
tokenRequest.user.phone_number = phoneNumber || undefined
```

**After:**
```javascript
// Only send phone if it's EXACTLY 10 digits (Plaid requirement)
if (phoneNumber && phoneNumber.length === 10) {
  tokenRequest.user.phone_number = phoneNumber
}
```

**Why This Fixes It:**
- Plaid requires phone numbers to be **EXACTLY 10 digits** or **omitted entirely**
- Sending `null`, `undefined`, `""`, or partial numbers causes "TOO_SHORT" error
- Now the function only sends the phone if it passes validation
- If no valid phone, Plaid Link still works (phone is optional)

---

## 📝 After Confirming This Works:

Delete this file! ✨


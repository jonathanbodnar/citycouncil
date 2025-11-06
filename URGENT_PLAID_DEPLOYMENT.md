# 🚨 URGENT: Plaid Edge Function NOT DEPLOYED YET

## ❌ Issue: "TOO_SHORT" Phone Error Still Showing

You're still seeing this error in the console:
```
Unable to parse phone number: TOO_SHORT
```

**This means the `plaid-create-link-token` Edge Function has NOT been deployed yet.**

---

## ✅ The Fix is Ready, Just Not Deployed

The code fix is:
- ✅ Written
- ✅ Committed to GitHub
- ✅ Pushed to `main` branch
- ❌ **NOT deployed to Supabase**

**Supabase Edge Functions don't auto-deploy from GitHub!** You must manually update them.

---

## 📋 Deploy NOW (2 minutes):

### **Step 1: Open Supabase Dashboard**
https://supabase.com/dashboard/project/utafetamgwukkbrlezev/functions/plaid-create-link-token

### **Step 2: Click on `plaid-create-link-token`**

### **Step 3: Delete ALL code and paste this clean version:**

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { PlaidApi, Configuration, PlaidEnvironments } from 'npm:plaid'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PLAID_CLIENT_ID = Deno.env.get('PLAID_CLIENT_ID')
const PLAID_SECRET = Deno.env.get('PLAID_SECRET')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

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

    let phoneNumber = null
    if (userData?.phone) {
      const cleaned = userData.phone.replace(/\D/g, '')
      const digits = cleaned.startsWith('1') && cleaned.length === 11 ? cleaned.slice(1) : cleaned
      if (digits.length === 10) {
        phoneNumber = digits
      }
    }

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

    if (authUser?.email) {
      tokenRequest.user.email_address = authUser.email
    }
    
    if (phoneNumber && phoneNumber.length === 10) {
      tokenRequest.user.phone_number = phoneNumber
    }
    
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
    console.error('Plaid Link Token Error:', error.response ? error.response.data : error.message)

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

### **Step 4: Click "Deploy" (green button)**

### **Step 5: Wait 30 seconds**

### **Step 6: Test**
1. Hard refresh your app: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
2. Go to Payouts tab
3. Click "Connect Bank Account"
4. **✅ No more "TOO_SHORT" error!**
5. **✅ Plaid Link should open successfully**

---

## 🔍 How to Verify It's Deployed:

1. **Check Edge Function Logs:**
   - Go to Supabase Dashboard → Edge Functions → `plaid-create-link-token`
   - Click "Logs" tab
   - Look for recent deployments

2. **Check Console Output:**
   - Before deployment: `Unable to parse phone number: TOO_SHORT`
   - After deployment: No phone error, Plaid Link opens ✅

3. **Test Plaid Link:**
   - If it opens without "Something went wrong" → ✅ Deployed successfully
   - If you still see "TOO_SHORT" → ❌ Not deployed yet

---

## 📝 Quick Checklist:

- [ ] Go to Supabase Dashboard
- [ ] Open `plaid-create-link-token` function
- [ ] Delete old code
- [ ] Paste new code (from above)
- [ ] Click "Deploy"
- [ ] Wait 30 seconds
- [ ] Hard refresh app
- [ ] Test Plaid Link
- [ ] ✅ Verify no "TOO_SHORT" error

---

## ⚠️ Common Mistakes:

1. **Copying from chat with formatting issues**
   - Solution: Copy from this file (clean code)

2. **Not waiting for deployment**
   - Solution: Wait 30 seconds after clicking Deploy

3. **Not hard refreshing the app**
   - Solution: `Cmd+Shift+R` to clear cache

4. **Deploying to wrong function**
   - Solution: Make sure it's `plaid-create-link-token`, not `moov-plaid-link-account`

---

## ✅ After Successful Deployment:

- ✅ Delete this file
- ✅ Test Plaid Link end-to-end
- ✅ Follow `PLAID_MOOV_INTEGRATION_TEST.md` for full testing
- ✅ Connect a real bank account to verify
- ✅ Check Moov Dashboard to see linked account

---

**The code is ready. Just needs to be deployed!** 🚀


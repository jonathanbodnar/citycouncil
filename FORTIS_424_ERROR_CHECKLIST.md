## 🚨 Fortis 424 Error - Troubleshooting Checklist

### **Error:** `Failed to load resource: the server responded with a status of 424 ()`

**Location:** `api.fortis.tech/v1/e.../transactions/run:1`

---

## **What 424 Means:**

**424 Failed Dependency** = Fortis API is rejecting the request **before** processing payment.

This is **NOT** a database issue. This is **NOT** a user_type issue. This is **Fortis refusing the API call itself**.

---

## **Immediate Checks:**

### **1. Check Supabase Edge Function Environment Variables**

**Go to:** Supabase Dashboard → Edge Functions → `fortis-intention` → Settings → Environment Variables

**Verify these exist:**
- ✅ `FORTIS_DEVELOPER_ID`
- ✅ `FORTIS_USER_ID`
- ✅ `FORTIS_USER_API_KEY`
- ✅ `FORTIS_LOCATION_ID`

**If any are missing:** ❌ Edge Function will return 500 error saying "Fortis credentials not configured"

---

### **2. Check Supabase Edge Function Logs**

**Go to:** Supabase Dashboard → Edge Functions → `fortis-intention` → Logs

**Look for recent errors around the time of failed order**

**Expected errors:**
- `Fortis credentials not configured` → Missing env vars
- `424` or `Failed Dependency` → Fortis rejecting request
- `401 Unauthorized` → Invalid API keys
- `403 Forbidden` → Account restricted
- `429 Too Many Requests` → Rate limited

---

### **3. Test Fortis API Directly**

**Option A: Use Fortis Dashboard**
1. Login to https://sandbox.fortis.tech/ (or production URL)
2. Go to → API Keys section
3. Verify keys are **active** and not expired
4. Check Location ID is correct

**Option B: Test with cURL**

```bash
curl -X POST https://api.fortis.tech/v1/elements/transaction/intention \
  -H "Content-Type: application/json" \
  -H "developer-id: YOUR_DEVELOPER_ID" \
  -H "user-id: YOUR_USER_ID" \
  -H "user-api-key: YOUR_API_KEY" \
  -d '{
    "action": "sale",
    "amount": 2500,
    "location_id": "YOUR_LOCATION_ID",
    "save_account": false
  }'
```

**Expected response:**
- ✅ `200 OK` with `client_token` → Fortis working
- ❌ `424` → Same error, Fortis issue
- ❌ `401` → Invalid credentials
- ❌ `403` → Account restricted

---

### **4. Check if it's Environment-Specific**

**Are you using:**
- Sandbox credentials in production URL? ❌
- Production credentials in sandbox URL? ❌

**Verify:**
- Credentials match environment (sandbox vs production)
- Base URL matches credentials: `https://api.fortis.tech/v1` vs `https://sandbox.fortis.tech/v1`

---

### **5. Check Fortis Account Status**

**Login to Fortis Dashboard**

**Check for:**
- ⚠️ Account suspended
- ⚠️ Payment method expired (if pay-as-you-go)
- ⚠️ Monthly limit reached
- ⚠️ Terms of service violation
- ⚠️ Verification required

---

### **6. Check Rate Limiting**

The Edge Function has **rate limiting** enabled:
```typescript
withRateLimit(async (req) => ..., RateLimitPresets.PAYMENT)
```

**Check Supabase logs for:**
- "Rate limit exceeded" messages
- Multiple failed requests from same IP

**If rate limited:**
- Wait 1 hour
- Or disable rate limit temporarily (edit Edge Function)

---

### **7. Check if Fortis is Down**

**Visit:** https://status.fortis.tech/ (if exists)

**Or check:** https://downdetector.com/ or similar

**Or test:** Simple API call from Postman/Insomnia

---

## **Most Likely Causes (Ranked):**

### **1. 🔴 Fortis API Keys Expired/Invalid** (Most Common)
- Keys rotated by Fortis
- Keys expired after X days
- Using wrong environment keys

**Fix:** Get new keys from Fortis dashboard, update Supabase env vars

### **2. 🔴 Fortis Account Issue**
- Billing problem
- Account suspended
- Verification needed

**Fix:** Contact Fortis support, check account status

### **3. 🟡 Location ID Changed**
- Fortis changed your location ID
- Using wrong location

**Fix:** Get correct location ID from Fortis dashboard

### **4. 🟡 Rate Limiting**
- Too many failed attempts
- Edge Function rate limit hit

**Fix:** Wait or disable rate limit

### **5. 🟢 Fortis API Down** (Unlikely)
- Temporary outage
- Maintenance

**Fix:** Wait for Fortis to recover

---

## **Quick Test to Isolate Issue:**

### **Test 1: Check Edge Function Credentials**

```bash
# In Supabase Dashboard SQL Editor
SELECT 'Check Edge Function env vars in Dashboard' as action;
```

Then go to Edge Functions → fortis-intention → Settings

### **Test 2: Call fortis-intention Edge Function Directly**

```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/fortis-intention \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"amount_cents": 2500}'
```

**Expected responses:**
- ✅ `200` with `clientToken` → Edge Function + Fortis working
- ❌ `500` "Fortis credentials not configured" → Missing env vars
- ❌ `502` with Fortis error → Fortis rejecting request (424)

### **Test 3: Check if ANY orders work**

- Try ordering from different talent
- Try with different user account
- Try different amount ($10, $50, $100)

**If NONE work:** → Fortis API issue  
**If SOME work:** → Something specific about this order (talent, user, amount)

---

## **What's NOT the Problem:**

- ❌ `user_type = NULL` (we fixed this)
- ❌ Database RLS (happens after Fortis)
- ❌ Order creation (happens after Fortis)
- ❌ Frontend code (Fortis iframe itself fails)

**The problem is:** Fortis API is rejecting our request to `/elements/transaction/intention`

---

## **Action Plan:**

1. ✅ Check Supabase Edge Function env vars exist
2. ✅ Check Supabase Edge Function logs for detailed error
3. ✅ Test Fortis API keys directly with cURL
4. ✅ Check Fortis dashboard for account status
5. ✅ Verify location_id is correct
6. ✅ Test with different amount/user/talent

---

## **If Still Stuck:**

**Get detailed error from Fortis:**

1. Go to Supabase → Edge Functions → `fortis-intention` → Logs
2. Find recent request with 424 error
3. Look for detailed error message from Fortis
4. Share that error message for specific fix

**Or:**

1. Test Fortis API directly with cURL (see above)
2. Get exact error message from Fortis
3. Contact Fortis support with that error

---

## **Status:**

🔴 **Fortis API rejecting transaction intentions**  
⚠️ **NOT a database issue**  
⚠️ **NOT a user_type issue**  
🎯 **Check Fortis credentials/account status**  

**Next Step:** Check Supabase Edge Function env vars and logs


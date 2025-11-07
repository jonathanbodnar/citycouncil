# 🔧 Disable JWT for receive-sms Function - STEP BY STEP

## Current Status:
```json
{
  "slug": "receive-sms",
  "verify_jwt": true    ← THIS IS THE PROBLEM
}
```

The `receive-sms` function currently requires JWT authentication (`verify_jwt: true`), which is why Twilio gets "Unauthorized" errors.

---

## ✅ Solution: Disable JWT Verification

###  **Method 1: Supabase Dashboard (Easiest)**

1. **Go to Edge Functions:**
   ```
   https://supabase.com/dashboard/project/utafetamgwukkbrlezev/functions
   ```

2. **Find `receive-sms` in the list** and click on it

3. **Look for "Settings" or "Configuration" tab**

4. **Find the "Verify JWT" toggle and turn it OFF**
   - Or look for "Require Authentication" → Turn OFF
   - Or "Allow Anonymous Access" → Turn ON

5. **Click "Save" or "Update"**

6. **Done!** The function will now accept requests without authentication

---

### **Method 2: Via Supabase CLI (Alternative)**

If you have the Supabase CLI installed:

```bash
# Navigate to your project
cd /Users/jonathanbodnar/ShoutOut

# Redeploy with --no-verify-jwt flag
supabase functions deploy receive-sms --no-verify-jwt --project-ref utafetamgwukkbrlezev
```

**Note:** You'll need the Supabase CLI installed:
```bash
npm install -g supabase
supabase login
```

---

### **Method 3: Create a new config.toml (For Future Deployments)**

Create or update `supabase/functions/receive-sms/config.toml`:

```toml
verify_jwt = false
```

Then redeploy:
```bash
supabase functions deploy receive-sms --project-ref utafetamgwukkbrlezev
```

---

## 🧪 Test After Disabling JWT:

### **1. Test with cURL (No apikey needed):**

```bash
curl -X POST "https://utafetamgwukkbrlezev.supabase.co/functions/v1/receive-sms" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=%2B16319438186&Body=Test+from+curl&MessageSid=SM123TEST"
```

**Expected:**
```xml
<?xml version="1.0" encoding="UTF-8"?><Response></Response>
```

### **2. Check Supabase Logs:**

Go to: https://supabase.com/dashboard/project/utafetamgwukkbrlezev/logs/edge-functions

Select: `receive-sms`

You should see:
```
📩 Incoming SMS: { from: '+16319438186', body: 'Test from curl', messageSid: 'SM123TEST' }
```

### **3. Update Twilio Webhook:**

Now you can use the **simple URL** without apikey:

```
https://utafetamgwukkbrlezev.supabase.co/functions/v1/receive-sms
```

**Steps:**
1. Go to: https://console.twilio.com/us1/develop/sms/services/MG0ed8e40e1201e534f5e15acd26b1681b
2. Click "Integration" tab
3. Set "Request URL" to: `https://utafetamgwukkbrlezev.supabase.co/functions/v1/receive-sms`
4. Method: "HTTP Post"
5. Click "Save"

### **4. Test Real SMS:**

1. Send SMS from Comms Center to Shawn
2. Reply from phone
3. Check Twilio Debugger → Should show 200 OK
4. Check Supabase logs → Should show incoming SMS
5. Refresh Comms Center → Reply appears!

---

## 🔒 Security Considerations:

After disabling JWT verification, the function is **publicly accessible**. This is fine for webhooks, but we can add extra security:

### **Option: Add Twilio Signature Verification**

Twilio sends an `X-Twilio-Signature` header with each request. We can verify this to ensure requests are actually from Twilio.

**To implement:**
1. Get your Twilio Auth Token from: https://console.twilio.com
2. Add it as environment variable `TWILIO_AUTH_TOKEN` in Supabase
3. Update the function to verify the signature (see TWILIO_APIKEY_STRIPPED_FIX.md for code)

This is more secure than the apikey approach anyway!

---

## Why This Works:

**Before (with verify_jwt: true):**
```
Twilio → POST /receive-sms
         ↓
Supabase checks for JWT in Authorization header or apikey param
         ↓
No valid JWT found
         ↓
Returns 401 Unauthorized ❌
         ↓
Function never runs (no logs)
```

**After (with verify_jwt: false):**
```
Twilio → POST /receive-sms
         ↓
Supabase allows the request through
         ↓
Function runs ✅
         ↓
Logs appear in Supabase
         ↓
Message saved to database
         ↓
Returns TwiML to Twilio
```

---

## Comparison with Other Functions:

Looking at your functions list, these have `verify_jwt: false`:
- ✅ `instagram-webhook` - webhook from Instagram, needs public access
- ✅ `moov-create-invite` - public endpoint

And these need JWT:
- ❌ `send-sms` - called from your app (needs auth)
- ❌ `fortis-intention` - called from your app (needs auth)

**The `receive-sms` function should be like `instagram-webhook`** - it's a webhook that external services call, so it needs public access.

---

## Quick Checklist:

- [ ] Go to Supabase Dashboard → Functions → receive-sms
- [ ] Find "Verify JWT" setting
- [ ] Turn it OFF (or set to false)
- [ ] Save changes
- [ ] Test with cURL (should work without apikey)
- [ ] Update Twilio webhook to simple URL
- [ ] Test real SMS reply
- [ ] Check Twilio debugger (should show 200 OK)
- [ ] Check Supabase logs (should see incoming SMS)
- [ ] Refresh Comms Center (should see reply)

---

## Status: 🎯 **READY TO FIX**

Just disable JWT verification in the Supabase Dashboard and your Twilio webhook will work immediately!

No code changes needed - it's just a configuration setting.


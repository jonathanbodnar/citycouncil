# 🔍 Twilio Webhook Not Calling Edge Function - DEBUG GUIDE

## Problem:
- Twilio webhook URL is set correctly
- Talent replies to SMS
- Edge Function shows **NO LOGS** (never gets called)
- This means: **Twilio is not sending the webhook request**

---

## 🎯 Step-by-Step Debugging:

### **Step 1: Verify Webhook URL is Actually Saved**

1. Go to your Messaging Service Integration page
2. **Expand the Request URL field** to see the full URL
3. Click inside the field and press `Ctrl+A` (Windows) or `Cmd+A` (Mac) to select all
4. Copy and paste it into a text editor
5. Verify it's EXACTLY:
   ```
   https://utafetamgwukkbrlezev.supabase.co/functions/v1/receive-sms?apikey=YOUR_SUPABASE_ANON_KEY
   ```

**Common Issues:**
- Field is too narrow, URL is truncated
- Missing `?apikey=` parameter
- Extra spaces at beginning or end
- Wrong function name (e.g., `send-sms` instead of `receive-sms`)

---

### **Step 2: Check Twilio Debugger for Webhook Errors**

This is **THE MOST IMPORTANT STEP** - it shows what Twilio is actually doing:

1. **Go to Twilio Debugger:**
   ```
   https://console.twilio.com/us1/monitor/logs/debugger
   ```

2. **Filter by:**
   - **Time:** Last 1 hour
   - **Log Level:** All or Errors only

3. **Send a test SMS reply** from your phone to the Twilio number

4. **Look for these events:**

   #### **✅ Good Signs:**
   - `POST /v1/receive-sms` - 200 OK (webhook called successfully)
   - No errors

   #### **❌ Bad Signs - Common Errors:**

   **Error 11200: HTTP Retrieval Failure**
   ```
   Unable to fetch content from https://...
   ```
   - **Cause:** URL is wrong, server is down, or CORS issue
   - **Fix:** Verify URL is correct, test it manually (see Step 3)

   **Error 11205: HTTP Connection Failure**
   ```
   Unable to connect to the specified URL
   ```
   - **Cause:** DNS issue, server unreachable
   - **Fix:** Check if Supabase is down, verify project ID

   **Error 11206: HTTP Protocol Violation**
   ```
   Unable to retrieve content from URL
   ```
   - **Cause:** Invalid response format
   - **Fix:** Edge Function must return valid TwiML XML

   **Error 12300: Invalid Content-Type**
   ```
   Webhook returned invalid content type
   ```
   - **Cause:** Missing `Content-Type: text/xml` header
   - **Fix:** Edge Function already has this, should be fine

   **Error 13224: Webhook URL Rejected**
   ```
   The URL is not valid
   ```
   - **Cause:** URL format is wrong (missing https://, has spaces, etc.)
   - **Fix:** Copy the exact URL from above

---

### **Step 3: Test the Edge Function Manually**

Let's verify the Edge Function itself works:

#### **Option A: Browser Test (Quick)**

1. Open a new browser tab
2. Paste this URL:
   ```
   https://utafetamgwukkbrlezev.supabase.co/functions/v1/receive-sms?apikey=YOUR_SUPABASE_ANON_KEY
   ```
3. Press Enter
4. **Expected:** You might see an error page (GET not supported), but this proves the URL is reachable

#### **Option B: cURL Test (Better)**

Open Terminal/Command Prompt and run:

```bash
curl -X POST "https://utafetamgwukkbrlezev.supabase.co/functions/v1/receive-sms?apikey=YOUR_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=%2B16145551234&Body=Test+message&MessageSid=SM123456"
```

**Expected Response:**
```xml
<?xml version="1.0" encoding="UTF-8"?><Response></Response>
```

**Then check Supabase Edge Function logs:**
- Go to: https://supabase.com/dashboard/project/utafetamgwukkbrlezev/logs/edge-functions
- Select: `receive-sms`
- You should see logs:
  ```
  📩 Incoming SMS: { from: '+16145551234', body: 'Test message', messageSid: 'SM123456' }
  ```

If this works, your Edge Function is fine - the problem is with Twilio calling it.

---

### **Step 4: Check Messaging Service Configuration**

#### **A. Verify Phone Number is Attached to Messaging Service**

1. Go to: https://console.twilio.com/us1/develop/sms/services/MG0ed8e40e1201e534f5e15acd26b1681b
2. Click **"Sender Pool"** tab
3. Verify your phone number `+12175898027` is listed
4. If not, add it:
   - Click "Add Senders"
   - Select your phone number
   - Click "Add"

#### **B. Check Integration Settings (Again)**

1. Click **"Integration"** tab
2. Under **"Incoming Messages"**:
   - **"Send a webhook"** radio button should be selected ✅
   - **Request URL** should have the full URL
   - **HTTP Method** should be "HTTP Post"
3. **IMPORTANT:** Scroll down and click **"Save"** if you made any changes

---

### **Step 5: Alternative - Set Webhook on Phone Number Directly**

If Messaging Service webhook isn't working, try setting it on the phone number:

1. Go to: https://console.twilio.com/us1/develop/phone-numbers/manage/incoming
2. Click on your phone number: `+12175898027`
3. Scroll to **"Messaging Configuration"**
4. Under **"A MESSAGE COMES IN"**:
   - **Webhook URL:**
     ```
     https://utafetamgwukkbrlezev.supabase.co/functions/v1/receive-sms?apikey=YOUR_SUPABASE_ANON_KEY
     ```
   - **HTTP Method:** POST
5. Click **"Save configuration"**
6. **Send a test reply**
7. Check Edge Function logs

**Note:** If the phone is in a Messaging Service, you might see a warning that the Messaging Service webhook takes precedence. In that case, stick with Step 4.

---

### **Step 6: Check for Twilio Account Issues**

#### **A. Verify Account Status**

1. Go to: https://console.twilio.com/us1/account/overview
2. Check if there's any:
   - ⚠️ Account suspension
   - ⚠️ Billing issues
   - ⚠️ Service interruptions

#### **B. Check Phone Number Status**

1. Go to: https://console.twilio.com/us1/develop/phone-numbers/manage/incoming
2. Click on `+12175898027`
3. Verify:
   - ✅ Status is "Active"
   - ✅ No errors or warnings

---

### **Step 7: Test with a Different Endpoint**

Let's verify Twilio webhooks work at all:

1. Go to: https://webhook.site
2. Click "Copy to clipboard" (copies a unique webhook URL)
3. Go to Twilio Messaging Service → Integration
4. Paste the webhook.site URL into "Request URL"
5. Click "Save"
6. **Send a test SMS reply** from your phone
7. Go back to webhook.site
8. **Check if you see a POST request**

**If you see a request:**
- ✅ Twilio webhooks work
- ❌ Problem is with your Supabase Edge Function URL
- **Next:** Re-check the Supabase URL (might have a typo)

**If you DON'T see a request:**
- ❌ Problem is with Twilio configuration
- **Next:** Check Steps 4-6 again

---

### **Step 8: Enable Verbose Logging in Twilio**

1. Go to: https://console.twilio.com/us1/develop/sms/settings/general
2. Enable **"Log Message Content"** (temporarily for debugging)
3. Save settings
4. Send a test reply
5. Check debugger again for more details

---

## 🔧 Quick Fixes Checklist:

- [ ] Webhook URL is complete and correct
- [ ] URL includes `?apikey=` parameter
- [ ] "Send a webhook" radio button is selected
- [ ] HTTP Method is "POST"
- [ ] Changes are saved (clicked "Save" button)
- [ ] Phone number is attached to Messaging Service
- [ ] Twilio Debugger shows webhook attempts
- [ ] Edge Function works when tested manually with cURL
- [ ] No account suspension or billing issues

---

## 📊 Expected Flow:

```
1. Talent sends SMS to +12175898027
   ↓
2. Twilio receives the message
   ↓
3. Twilio checks Messaging Service webhook URL
   ↓
4. Twilio POSTs to: https://utafetamgwukkbrlezev.supabase.co/functions/v1/receive-sms?apikey=...
   ↓
5. Edge Function receives request (logs appear)
   ↓
6. Edge Function processes and saves to database
   ↓
7. Edge Function returns TwiML
   ↓
8. Message appears in Comms Center
```

---

## 🚨 Most Likely Issues:

Based on your symptoms (no logs), it's one of these:

1. **Webhook URL is incomplete/wrong** (90% chance)
   - Field is too narrow, URL is truncated
   - Copy-paste the FULL URL again

2. **Webhook not saved** (5% chance)
   - You updated it but didn't click "Save"
   - Go back and click "Save" again

3. **Phone not connected to Messaging Service** (3% chance)
   - Webhook is on Messaging Service, but phone isn't in Sender Pool
   - Add phone to Sender Pool

4. **Twilio Debugger shows errors** (2% chance)
   - Check debugger for Error 11200, 11205, etc.
   - Fix based on error message

---

## 📞 What to Report Back:

After going through these steps, report:

1. **Twilio Debugger Results:**
   - Any errors or warnings?
   - Does it show webhook attempts?
   - What's the HTTP status code?

2. **Manual cURL Test:**
   - Did it return the TwiML response?
   - Did logs appear in Supabase?

3. **Webhook.site Test:**
   - Did webhook.site receive a request?
   - If yes, Twilio works - problem is Supabase URL
   - If no, Twilio isn't sending webhooks at all

4. **Screenshot:**
   - Take a screenshot of the Integration tab showing the full webhook URL field

---

## 🎯 Next Steps:

Based on your findings, we can:
- Fix the webhook URL if it's wrong
- Debug Supabase Edge Function if cURL fails
- Contact Twilio support if webhooks aren't being sent at all
- Try alternative webhook configuration (phone number vs. Messaging Service)


# 🔧 TWILIO WEBHOOK FIX - NOT RECEIVING REPLIES

## ❌ Problem:
- Twilio receives the reply text (you can see it in Twilio console)
- But it's NOT showing in Comms Center
- Edge function `receive-sms` shows NO logs
- This means: **Twilio is not calling your webhook!**

---

## ✅ Solution:

### **The Issue in Your Screenshot:**
Your webhook URL is **INCOMPLETE**. It shows:
```
https://utafetamgwukkbrlezev.supabase.co/functi...
```

It should be the FULL URL below ⬇️

---

## 🎯 EXACT STEPS TO FIX:

### **Step 1: Copy This EXACT URL**

```
https://utafetamgwukkbrlezev.supabase.co/functions/v1/receive-sms?apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0YWZldGFtZ3d1a2ticmxlemV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4NjgzMDAsImV4cCI6MjA3NTQ0NDMwMH0.6ycEWh2sLck45S8zjzNU0GqHTu_P1hh86YvP43E-Jk4
```

**CRITICAL:** The `?apikey=` parameter is REQUIRED for Supabase Edge Functions!

---

### **Step 2: Update Twilio Webhook**

1. Go to your Twilio Messaging Service: **Marketing A2P Messaging Service**
   - **Direct Link:** https://console.twilio.com/us1/develop/sms/services/MG0ed8e40e1201e534f5e15acd26b1681b

2. Click **"Integration"** tab (where you are now)

3. Under **"Incoming Messages"**, find **"Request URL"**

4. **CLEAR** the existing URL

5. **PASTE** the new URL (including the apikey parameter):
   ```
   https://utafetamgwukkbrlezev.supabase.co/functions/v1/receive-sms?apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0YWZldGFtZ3d1a2ticmxlemV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4NjgzMDAsImV4cCI6MjA3NTQ0NDMwMH0.6ycEWh2sLck45S8zjzNU0GqHTu_P1hh86YvP43E-Jk4
   ```

6. Ensure **"HTTP Post"** is selected in the dropdown (it already is ✅)

7. Click **"Save"** at the bottom of the page

---

### **Step 3: Test Immediately**

1. **Send a test message** from Comms Center to a talent
2. **Reply to that message** from the talent's phone
3. **Check Edge Function Logs:**
   - Go to: https://supabase.com/dashboard/project/utafetamgwukkbrlezev/logs/edge-functions
   - Select: `receive-sms` function
   - You should see:
     ```
     📩 Incoming SMS: { from: '+1XXXXXXXXXX', body: 'Test reply' }
     Phone lookup: { from: '+1XXXXXXXXXX', cleanPhone: 'XXXXXXXXXX' }
     User lookup result: { user: { id: '...', full_name: '...' }, error: null }
     ✅ Message saved to database
     ```

4. **Refresh Comms Center** - the reply should appear in the conversation!

---

## 🔍 Why It Wasn't Working:

### **Common Causes:**

1. **URL Too Long for Input Field** ❌
   - The text field might have truncated the URL
   - Always copy-paste the full URL and verify it's complete

2. **Missing `/functions/v1/receive-sms`** ❌
   - Your screenshot shows it ends at `/functi...`
   - The full path is required for the webhook to work

3. **Wrong HTTP Method** ✅ (Yours is correct)
   - You already have "HTTP Post" selected - good!

4. **Webhook on Phone Number Instead of Messaging Service** ✅ (Yours is correct)
   - You're correctly setting it on the Messaging Service - good!

---

## 📋 Verification Checklist:

After saving, verify these:

- [ ] URL is complete with apikey: `https://utafetamgwukkbrlezev.supabase.co/functions/v1/receive-sms?apikey=eyJh...Jk4`
- [ ] Method is: `HTTP Post`
- [ ] "Send a webhook" radio button is selected
- [ ] Click "Save" button
- [ ] Wait 10 seconds for Twilio to update
- [ ] Send test SMS from Comms Center
- [ ] Reply from phone
- [ ] Check Supabase logs for `receive-sms` function
- [ ] See logs with incoming message
- [ ] Refresh Comms Center
- [ ] Reply appears in conversation

---

## 🐛 Troubleshooting:

### **Still No Logs After Fixing URL?**

1. **Check Twilio Debugger:**
   - Go to: https://console.twilio.com/us1/monitor/logs/debugger
   - Filter by: Last 30 minutes
   - Look for: Incoming message events
   - Check if webhook is being called
   - Look for any errors (401, 403, 500, etc.)

2. **Verify Webhook URL in Twilio:**
   - Go back to Integration tab
   - Click in the Request URL field
   - Press `Ctrl+A` (select all) or `Cmd+A` on Mac
   - Verify the ENTIRE URL is selected and matches (including apikey):
     ```
     https://utafetamgwukkbrlezev.supabase.co/functions/v1/receive-sms?apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0YWZldGFtZ3d1a2ticmxlemV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4NjgzMDAsImV4cCI6MjA3NTQ0NDMwMH0.6ycEWh2sLck45S8zjzNU0GqHTu_P1hh86YvP43E-Jk4
     ```

3. **Test Webhook Manually:**
   - Use this cURL command to test the endpoint:
   ```bash
   curl -X POST "https://utafetamgwukkbrlezev.supabase.co/functions/v1/receive-sms?apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0YWZldGFtZ3d1a2ticmxlemV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4NjgzMDAsImV4cCI6MjA3NTQ0NDMwMH0.6ycEWh2sLck45S8zjzNU0GqHTu_P1hh86YvP43E-Jk4" \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "From=%2B16145551234&Body=Test&MessageSid=SM123"
   ```
   - Should return: `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`
   - Check logs for activity

4. **Phone Number Format Check:**
   - Ensure the talent's phone in the `users` table is stored as 10 digits
   - Example: `6145551234` (not `+16145551234` or `(614) 555-1234`)
   - The Edge Function strips the `+1` prefix from Twilio's format

---

## 🎯 Expected Behavior After Fix:

### **When Talent Replies:**

1. ✅ Talent sends SMS to your Twilio number: `+12175898027`
2. ✅ Twilio receives the message
3. ✅ Twilio calls your webhook: `https://utafetamgwukkbrlezev.supabase.co/functions/v1/receive-sms?apikey=...`
4. ✅ Edge function processes the message:
   - Extracts phone number from `From` field
   - Cleans phone: `+16145551234` → `6145551234`
   - Looks up user by phone in `users` table
   - Finds talent_id from `talent_profiles` table
   - Inserts message into `sms_messages` table with `from_admin: false`
5. ✅ Function returns TwiML to Twilio
6. ✅ Message appears in Comms Center when you refresh or select that talent

---

## 📝 Quick Reference:

| Setting | Value |
|---------|-------|
| **Messaging Service ID** | `MG0ed8e40e1201e534f5e15acd26b1681b` |
| **Phone Number** | `+12175898027` |
| **Webhook URL** | `https://utafetamgwukkbrlezev.supabase.co/functions/v1/receive-sms?apikey=eyJh...E-Jk4` |
| **HTTP Method** | `POST` |
| **Location** | Messaging Service → Integration → Incoming Messages |

---

## ✅ Status After Fix:

Once you update the webhook URL:

- [x] Full URL is saved in Twilio
- [x] Twilio calls Edge Function on incoming SMS
- [x] Edge Function logs appear in Supabase
- [x] Messages are saved to `sms_messages` table
- [x] Replies show up in Comms Center
- [x] Two-way SMS is working! 🎉

---

## 🚀 Next Steps:

1. **Update the webhook URL RIGHT NOW** with the full URL above
2. **Save** the Messaging Service settings
3. **Send a test message** and reply
4. **Check logs** to confirm webhook is being called
5. **Celebrate** when you see the reply in Comms Center! 🎊


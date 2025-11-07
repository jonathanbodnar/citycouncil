# Fix Webhook for Twilio Messaging Service

## Issue
Using **Marketing A2P Messaging Service** - webhook must be configured on the Messaging Service, not the phone number!

---

## Step 1: Go to Messaging Service Settings

**Your Messaging Service:** `MG0ed8e40e1201e534f5e15acd26b1681b`

**Direct Link:**
```
https://console.twilio.com/us1/develop/sms/services/MG0ed8e40e1201e534f5e15acd26b1681b
```

Or navigate:
1. Twilio Console → **Messaging** → **Services**
2. Click on your service (the one with your phone number 12175898027)

---

## Step 2: Configure Incoming Message Webhook

1. In the Messaging Service, go to **"Integration"** tab
2. Find **"Incoming Messages"** section
3. Set:
   - **Request URL:** 
     ```
     https://utafetamgwukkbrlezev.supabase.co/functions/v1/receive-sms?apikey=YOUR_ANON_KEY
     ```
   - **Method:** HTTP POST
4. Click **"Save"**

---

## Step 3: Alternative - Check Messaging Service Webhooks

If you don't see "Integration" tab:

1. Go to: https://console.twilio.com/us1/develop/sms/services
2. Click your Messaging Service
3. Look for **"Integration Settings"** or **"Webhooks"**
4. Find **"Incoming Message URL"**
5. Set to: `https://utafetamgwukkbrlezev.supabase.co/functions/v1/receive-sms?apikey=YOUR_ANON_KEY`

---

## Step 4: Get Your Anon Key

**Go to:** https://supabase.com/dashboard/project/utafetamgwukkbrlezev/settings/api

Copy the **anon public** key and replace `YOUR_ANON_KEY` in the webhook URL.

---

## Step 5: Test

1. Send SMS from Comms Center
2. Reply from your phone
3. Check Supabase Edge Function logs: https://supabase.com/dashboard/project/utafetamgwukkbrlezev/logs/edge-functions
4. Should see: `📩 Incoming SMS: { from: '+12175898027', body: '...' }`
5. Refresh Comms Center - reply appears!

---

## Why This Is Different

**Messaging Service vs Direct Phone Number:**

❌ **Direct Phone Number Webhook** - Only works if NOT using Messaging Service
✅ **Messaging Service Webhook** - Required when phone is connected to a Messaging Service

Since your phone (12175898027) is connected to Messaging Service `MG0ed8e40e1201e534f5e15acd26b1681b`, the webhook must be set on the Messaging Service itself.

---

## Quick Reference

**Messaging Service ID:** `MG0ed8e40e1201e534f5e15acd26b1681b`

**Phone Number:** `+12175898027`

**Webhook URL:**
```
https://utafetamgwukkbrlezev.supabase.co/functions/v1/receive-sms?apikey=YOUR_ANON_KEY
```

**Where to set:**
- Twilio Console → Messaging → Services → [Your Service] → Integration → Incoming Messages

---

## Troubleshooting

### Can't find Integration settings?
Try these locations:
1. Messaging Service → **Integration**
2. Messaging Service → **Properties** → Webhooks
3. Messaging Service → **Settings** → Incoming Message URL

### Still not seeing logs?
1. Check Twilio Debugger: https://console.twilio.com/us1/monitor/logs/debugger
2. Look for incoming message webhook attempts
3. Verify Messaging Service webhook is saved

### Messages show in Twilio but not Comms Center?
1. Check if webhook was called in debugger
2. If called, check Supabase logs for errors
3. Verify phone number format in users table (10 digits)

---

## Result

After setting the Messaging Service webhook:
- ✅ Twilio receives reply
- ✅ Calls your receive-sms Edge Function
- ✅ Function saves to sms_messages table
- ✅ Message appears in Comms Center

🎉 Full two-way SMS working!


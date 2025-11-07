# 📱 Twilio Webhook Setup - Enable Two-Way SMS

## Problem
When talent replies to SMS messages, they get: *"Configure your number's SMS URL to change this message"*

## Solution
Configure Twilio to send incoming SMS replies to our Supabase Edge Function.

---

## Step 1: Deploy the receive-sms Edge Function

### Option A: Via Supabase CLI (Recommended)
```bash
cd /Users/jonathanbodnar/ShoutOut
supabase functions deploy receive-sms
```

### Option B: Via Supabase Dashboard
1. Go to: https://supabase.com/dashboard/project/utafetamgwukkbrlezev/functions
2. Click **"Create a new function"**
3. Name: `receive-sms`
4. Copy code from: `supabase/functions/receive-sms/index.ts`
5. Click **"Deploy function"**

**After deployment, copy the function URL:**
```
https://utafetamgwukkbrlezev.supabase.co/functions/v1/receive-sms
```

---

## Step 2: Configure Twilio Webhook

### 2.1 Login to Twilio Console
Go to: https://console.twilio.com/

### 2.2 Navigate to Phone Numbers
1. Click **"Phone Numbers"** → **"Manage"** → **"Active numbers"**
2. Click on your Twilio phone number (the one sending SMS)

### 2.3 Configure Messaging Webhook
Scroll down to **"Messaging"** section:

**A number that can send and receive messages and calls**

1. Find **"A MESSAGE COMES IN"** section
2. Select: **"Webhook"**
3. Paste URL: 
   ```
   https://utafetamgwukkbrlezev.supabase.co/functions/v1/receive-sms
   ```
4. Method: **"HTTP POST"**
5. Click **"Save"**

---

## Step 3: Test Two-Way SMS

### 3.1 Send a test message from Comms Center
1. Go to Admin Dashboard → Comms Center
2. Select a talent
3. Send: "Test message"

### 3.2 Reply from your phone
Reply with: "Got it!"

### 3.3 Check Comms Center
- Refresh the page
- You should see the reply appear in the chat
- The message should show on the **left side** (from talent)

---

## Step 4: Verify in Logs

### Check Supabase Logs
1. Go to: https://supabase.com/dashboard/project/utafetamgwukkbrlezev/logs/edge-functions
2. Select **"receive-sms"** function
3. Look for:
   ```
   📩 Incoming SMS: { from: '+12175898027', body: 'Got it!', ... }
   ✅ Message saved to database
   ```

### Check Twilio Logs
1. Go to: https://console.twilio.com/us1/monitor/logs/sms
2. Find the incoming message
3. Status should be: **"delivered"** (200 OK)

---

## Troubleshooting

### Issue: Talent replies still show "Configure your number's SMS URL"
**Fix:** Double-check the webhook URL in Twilio console. Must be exact:
```
https://utafetamgwukkbrlezev.supabase.co/functions/v1/receive-sms
```

### Issue: Messages not appearing in Comms Center
**Possible causes:**
1. **Phone number mismatch** - Check that `users.phone` matches the sender's number
2. **RLS policy** - Verify talent can insert messages
3. **Edge Function error** - Check Supabase logs

**Debug SQL:**
```sql
-- Check if user exists with this phone
SELECT * FROM users WHERE phone = '2175898027';

-- Check if messages are being saved
SELECT * FROM sms_messages 
WHERE from_admin = false 
ORDER BY sent_at DESC 
LIMIT 5;
```

### Issue: Edge Function returns 500 error
**Fix:** Check that environment variables are set:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

These should be auto-set by Supabase.

---

## How It Works

```
┌─────────────┐
│   Talent    │
│  +1 217...  │
└──────┬──────┘
       │ "Got it!"
       ↓
┌─────────────┐
│   Twilio    │ (Receives SMS)
└──────┬──────┘
       │ POST /receive-sms
       ↓
┌─────────────────────────┐
│  Supabase Edge Function │
│     receive-sms         │
└──────┬──────────────────┘
       │ 1. Parse phone number
       │ 2. Find talent by phone
       │ 3. Save to sms_messages
       ↓
┌─────────────────┐
│  sms_messages   │ (Database)
│  from_admin=false
└─────────────────┘
       ↓
┌─────────────────┐
│  Comms Center   │ (Auto-refresh)
│  Shows reply    │
└─────────────────┘
```

---

## Security Notes

✅ **HTTPS Only** - Twilio webhook must use HTTPS
✅ **No Auth Required** - Twilio sends form data, not JWT
✅ **RLS Enabled** - Database policies protect data
✅ **Phone Validation** - Function verifies user exists

---

## Cost

**Twilio charges:**
- Incoming SMS: $0.0079 per message
- Outgoing SMS: $0.0079 per message

**Example:**
- 100 two-way conversations/month = $1.58

---

## Next Steps

After setup:
1. ✅ Deploy `receive-sms` Edge Function
2. ✅ Configure Twilio webhook URL
3. ✅ Test with a real reply
4. ✅ Confirm message appears in Comms Center

**Result:** Full two-way SMS communication! 🎉


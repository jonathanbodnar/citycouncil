# Fix Twilio 401 Unauthorized Error

## Problem
Twilio webhook getting `401 Unauthorized` when calling:
```
https://utafetamgwukkbrlezev.supabase.co/functions/v1/receive-sms
```

## Root Cause
Supabase Edge Functions require authentication by default. Twilio webhooks don't send auth headers.

## Solution: Make Edge Function Publicly Accessible

### Option 1: Use anon key in URL (Recommended)
Change Twilio webhook URL to include the anon key as a query parameter:

```
https://utafetamgwukkbrlezev.supabase.co/functions/v1/receive-sms?apikey=YOUR_ANON_KEY
```

**Get your anon key:**
1. Go to: https://supabase.com/dashboard/project/utafetamgwukkbrlezev/settings/api
2. Copy the **anon/public** key
3. Add to Twilio webhook URL

**Example:**
```
https://utafetamgwukkbrlezev.supabase.co/functions/v1/receive-sms?apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Option 2: Disable Auth for Edge Function (Not Recommended)
This would require changing the Edge Function deployment settings, which isn't easily done via dashboard.

---

## Steps to Fix

### 1. Get Supabase Anon Key
```bash
# From project settings
https://supabase.com/dashboard/project/utafetamgwukkbrlezev/settings/api
```

Copy the **anon public** key.

### 2. Update Twilio Webhook URL
1. Go to: https://console.twilio.com/us1/develop/phone-numbers/manage/incoming
2. Click your phone number
3. Under **"A MESSAGE COMES IN"**
4. Change webhook URL to:
   ```
   https://utafetamgwukkbrlezev.supabase.co/functions/v1/receive-sms?apikey=YOUR_ANON_KEY_HERE
   ```
5. Click **Save**

### 3. Test
1. Send SMS from Comms Center
2. Reply from your phone
3. Check Twilio logs: Should now show `200 OK` instead of `401`
4. Check Supabase Edge Function logs for: `✅ Message saved to database`
5. Refresh Comms Center - reply should appear

---

## Security Note

**Is it safe to put anon key in Twilio webhook?**

✅ **YES** - The anon key is meant to be public. It's protected by:
- Row Level Security (RLS) on database
- Edge Function only allows INSERT with valid talent_id
- No sensitive data is returned to Twilio

The anon key only allows:
- Public reads (controlled by RLS)
- Authenticated writes (controlled by RLS)
- Edge Function invocation

---

## Alternative: Verify Twilio Signature (Advanced)

For production, you can add Twilio signature verification to ensure requests are actually from Twilio:

```typescript
import { validateRequest } from 'https://deno.land/x/twilio@0.1.0/mod.ts';

const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN')!;
const isValid = validateRequest(
  twilioAuthToken,
  req.headers.get('X-Twilio-Signature'),
  url,
  formData
);

if (!isValid) {
  return new Response('Unauthorized', { status: 401 });
}
```

But for now, the anon key in URL is the simplest fix.

---

## Quick Reference

**Twilio Webhook URL Format:**
```
https://utafetamgwukkbrlezev.supabase.co/functions/v1/receive-sms?apikey=ANON_KEY
```

**Where to set:**
- Twilio Console → Phone Numbers → Active Numbers → [Your Number] → Messaging → "A MESSAGE COMES IN"

**How to verify it works:**
- Twilio logs show `200 OK`
- Supabase logs show `✅ Message saved to database`
- Comms Center shows the reply


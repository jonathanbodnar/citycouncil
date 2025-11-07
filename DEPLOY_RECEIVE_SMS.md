# Deploy receive-sms Edge Function

## Issue
Twilio says "received" but Comms Center doesn't show replies. No logs in receive-sms function.

**Root cause:** The `receive-sms` Edge Function **hasn't been deployed yet!**

---

## Quick Deploy via Supabase Dashboard

### Step 1: Go to Edge Functions
https://supabase.com/dashboard/project/utafetamgwukkbrlezev/functions

### Step 2: Create New Function
1. Click **"Create a new function"**
2. Name: `receive-sms`
3. Copy code from: `supabase/functions/receive-sms/index.ts`

### Step 3: Paste the Code
Copy this entire code block:

```typescript
// Twilio Webhook to Receive SMS Replies from Talent
// This function receives incoming SMS messages and stores them in the database

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse Twilio's form data
    const formData = await req.formData();
    const from = formData.get('From') as string; // Phone number that sent the message
    const body = formData.get('Body') as string; // Message content
    const messageSid = formData.get('MessageSid') as string; // Twilio message ID

    console.log('📩 Incoming SMS:', { from, body, messageSid });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Clean phone number (remove all non-digits)
    let cleanPhone = from.replace(/\D/g, '');
    
    // If phone starts with 1 and is 11 digits, strip the leading 1
    // Twilio sends +16145551234, we store 6145551234
    if (cleanPhone.length === 11 && cleanPhone.startsWith('1')) {
      cleanPhone = cleanPhone.substring(1);
    }
    
    console.log('Phone lookup:', { from, cleanPhone });
    
    // Find the talent by phone number
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('phone', cleanPhone)
      .single();
    
    console.log('User lookup result:', { user, error: userError });

    if (userError || !user) {
      console.error('❌ User not found for phone:', from);
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        {
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'text/xml' 
          }
        }
      );
    }

    // Find talent profile
    const { data: talent, error: talentError } = await supabase
      .from('talent_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (talentError || !talent) {
      console.error('❌ Talent profile not found for user:', user.id);
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        {
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'text/xml' 
          }
        }
      );
    }

    // Save the incoming message to database
    const { error: insertError } = await supabase
      .from('sms_messages')
      .insert({
        talent_id: talent.id,
        from_admin: false, // This is from talent
        message: body,
        status: 'sent',
        sent_at: new Date().toISOString()
      });

    if (insertError) {
      console.error('❌ Error saving message:', insertError);
      throw insertError;
    }

    console.log('✅ Message saved to database');

    // Respond to Twilio with empty TwiML (no auto-reply)
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'text/xml' 
        }
      }
    );

  } catch (error: any) {
    console.error('❌ Error processing incoming SMS:', error);
    
    // Still return valid TwiML even on error
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      {
        status: 200, // Always return 200 to Twilio
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'text/xml' 
        }
      }
    );
  }
});
```

### Step 4: Deploy
Click **"Deploy function"** and wait ~30 seconds

### Step 5: Get Function URL
After deployment, copy the function URL:
```
https://utafetamgwukkbrlezev.supabase.co/functions/v1/receive-sms
```

---

## Configure Twilio Webhook

### Step 1: Get Anon Key
Go to: https://supabase.com/dashboard/project/utafetamgwukkbrlezev/settings/api

Copy the **anon public** key

### Step 2: Set Webhook in Twilio
1. Go to: https://console.twilio.com/us1/develop/phone-numbers/manage/incoming
2. Click your phone number
3. Scroll to **"Messaging"**
4. Under **"A MESSAGE COMES IN"**:
   - Select: **Webhook**
   - URL: `https://utafetamgwukkbrlezev.supabase.co/functions/v1/receive-sms?apikey=YOUR_ANON_KEY`
   - Method: **HTTP POST**
5. Click **"Save"**

---

## Test It

### 1. Send test message
From Comms Center, send: "Test from admin"

### 2. Reply from phone
Reply: "Got it!"

### 3. Check Supabase Logs
https://supabase.com/dashboard/project/utafetamgwukkbrlezev/logs/edge-functions

Select: **receive-sms**

Should see:
```
📩 Incoming SMS: { from: '+12175898027', body: 'Got it!', messageSid: '...' }
Phone lookup: { from: '+12175898027', cleanPhone: '2175898027' }
User lookup result: { user: { id: '...', full_name: '...' }, error: null }
✅ Message saved to database
```

### 4. Check Comms Center
Refresh the page - reply should appear on the left side! 💬

---

## Troubleshooting

### No logs in receive-sms function
- Function not deployed yet (deploy via dashboard)
- Twilio webhook URL is wrong
- Twilio webhook not saved

### Logs show "User not found"
- Phone number format mismatch
- Run this SQL to check:
  ```sql
  SELECT email, phone FROM users WHERE phone IS NOT NULL;
  ```
- Phone should be 10 digits (e.g., `2175898027`)

### Logs show "Talent profile not found"
- User exists but has no talent_profiles record
- Check: `SELECT * FROM talent_profiles WHERE user_id = 'USER_ID'`

### Message saved but not showing in Comms Center
- Refresh the page (auto-refresh is every 5 seconds)
- Check `sms_messages` table: `SELECT * FROM sms_messages ORDER BY sent_at DESC LIMIT 10`
- RLS policy might be blocking read

---

## Quick Checklist

- [ ] Deploy `receive-sms` Edge Function via Supabase Dashboard
- [ ] Get anon key from Supabase settings
- [ ] Set Twilio webhook URL with anon key
- [ ] Save Twilio webhook configuration
- [ ] Test by replying to SMS
- [ ] Check Supabase Edge Function logs
- [ ] Verify message appears in Comms Center

**Result:** Full two-way SMS! 🎉


# 🔧 Twilio Stripping ?apikey= Parameter - SOLUTION

## Problem:
- You enter webhook URL: `https://...?apikey=eyJh...`
- Twilio saves it
- But debugger shows: `https://...` (without apikey)
- Edge Function returns "Unauthorized"

**Twilio appears to be stripping the query parameter!**

---

## Root Cause:

Supabase Edge Functions require authentication by default. There are a few possible issues:

1. **Twilio UI strips query params** from webhook URLs
2. **Supabase requires apikey** but Twilio can't/won't send it
3. **Need to configure function for anonymous access**

---

## Solution: Make Edge Function Publicly Accessible

Since this is a webhook that Twilio calls (not client code), we need to allow unauthenticated access.

### **Option 1: Use Supabase Dashboard (Recommended)**

1. **Go to Edge Functions Settings:**
   ```
   https://supabase.com/dashboard/project/utafetamgwukkbrlezev/functions
   ```

2. **Click on `receive-sms` function**

3. **Look for "Function Settings" or "Configuration"**

4. **Find "Verify JWT" or "Require Authentication" setting**

5. **Disable JWT verification** (allow anonymous access)

6. **Save settings**

---

### **Option 2: Deploy with --no-verify-jwt Flag**

If you're deploying via CLI, use:

```bash
supabase functions deploy receive-sms --no-verify-jwt
```

This tells Supabase to allow requests without authentication.

---

### **Option 3: Add Custom Auth Check in Function Code**

We can verify the request is from Twilio by checking the signature:

**Create new file:** `supabase/functions/receive-sms/index.ts` (updated)

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHmac } from 'https://deno.land/std@0.168.0/node/crypto.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Verify request is from Twilio
function verifyTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string,
  authToken: string
): boolean {
  try {
    // Build the data string
    let data = url;
    Object.keys(params).sort().forEach(key => {
      data += key + params[key];
    });

    // Create HMAC SHA1 hash
    const hmac = createHmac('sha1', authToken);
    hmac.update(data);
    const expectedSignature = hmac.digest('base64');

    return expectedSignature === signature;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('📩 Incoming webhook from:', req.headers.get('user-agent'));

    // Get Twilio signature for verification
    const twilioSignature = req.headers.get('x-twilio-signature');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');

    // Parse form data
    const formData = await req.formData();
    const from = formData.get('From') as string;
    const body = formData.get('Body') as string;
    const messageSid = formData.get('MessageSid') as string;

    // Optional: Verify request is from Twilio
    if (twilioSignature && twilioAuthToken) {
      const params: Record<string, string> = {};
      formData.forEach((value, key) => {
        params[key] = value.toString();
      });

      const url = req.url;
      const isValid = verifyTwilioSignature(url, params, twilioSignature, twilioAuthToken);

      if (!isValid) {
        console.error('❌ Invalid Twilio signature');
        return new Response(
          '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'text/xml' }
          }
        );
      }
      console.log('✅ Twilio signature verified');
    }

    console.log('📩 Incoming SMS:', { from, body, messageSid });

    // Rest of the function continues as before...
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ... (rest of existing code)

  } catch (error: any) {
    console.error('❌ Error processing incoming SMS:', error);
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/xml' }
      }
    );
  }
});
```

---

## Quick Fix: Disable JWT Verification

The fastest solution is **Option 1** - disable JWT verification in Supabase Dashboard.

### **Steps:**

1. Go to: https://supabase.com/dashboard/project/utafetamgwukkbrlezev/functions

2. Find `receive-sms` function

3. Click on it to open settings

4. Look for one of these:
   - "Verify JWT" toggle → Turn OFF
   - "Require Authentication" → Turn OFF
   - "Public Access" → Turn ON

5. Save changes

6. **Test immediately:**
   ```bash
   curl -X POST "https://utafetamgwukkbrlezev.supabase.co/functions/v1/receive-sms" \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "From=%2B16145551234&Body=Test&MessageSid=SM123"
   ```

   Should return:
   ```xml
   <?xml version="1.0" encoding="UTF-8"?><Response></Response>
   ```

7. **Update Twilio webhook to simple URL** (no apikey needed):
   ```
   https://utafetamgwukkbrlezev.supabase.co/functions/v1/receive-sms
   ```

---

## Alternative: Check Twilio's URL Encoding

Sometimes Twilio's UI has issues with long URLs. Try:

### **Method A: Add apikey via Twilio's "Parameters" Section**

Some Twilio configurations allow you to add query parameters separately:

1. Leave Request URL as: `https://utafetamgwukkbrlezev.supabase.co/functions/v1/receive-sms`
2. Look for "Additional Parameters" or "Query Parameters" section
3. Add:
   - **Key:** `apikey`
   - **Value:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0YWZldGFtZ3d1a2ticmxlemV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4NjgzMDAsImV4cCI6MjA3NTQ0NDMwMH0.6ycEWh2sLck45S8zjzNU0GqHTu_P1hh86YvP43E-Jk4`

### **Method B: URL Encode the apikey**

Try encoding the URL with the apikey:

```
https://utafetamgwukkbrlezev.supabase.co/functions/v1/receive-sms?apikey=YOUR_SUPABASE_ANON_KEY
```

Make sure the entire URL is on ONE LINE with no spaces or line breaks.

---

## Recommended Solution:

**Disable JWT verification for this specific function** since:
- It's a webhook (not client-facing)
- Twilio can't easily send the apikey
- The function uses service role key internally anyway
- We can add Twilio signature verification for security

---

## Security Note:

After disabling JWT verification, the function is publicly accessible. To secure it:

1. **Add Twilio signature verification** (Option 3 above)
2. **Set TWILIO_AUTH_TOKEN** environment variable in Supabase
3. **Function will verify** requests are actually from Twilio

This is more secure than relying on the apikey in the URL anyway!

---

## Testing:

After disabling JWT verification:

1. **cURL test should work:**
   ```bash
   curl -X POST "https://utafetamgwukkbrlezev.supabase.co/functions/v1/receive-sms" \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "From=%2B16319438186&Body=Test&MessageSid=SM123"
   ```

2. **Check logs for activity**

3. **Update Twilio webhook** to simple URL (no apikey)

4. **Test with real SMS reply**

5. **Check Twilio debugger** - should show 200 OK

---

## Next Steps:

1. Go to Supabase Dashboard → Functions → receive-sms
2. Disable JWT verification / Enable public access
3. Update Twilio webhook to simple URL (remove apikey)
4. Test with cURL
5. Test with real SMS
6. Done! ✅


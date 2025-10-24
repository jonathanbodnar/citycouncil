# Deploy Edge Function via Supabase Dashboard (Web UI)

## 📋 **Step-by-Step Instructions:**

### **Step 1: Go to Supabase Dashboard**

Visit: https://supabase.com/dashboard/project/utafetamgwukkbrlezev

*(Or go to https://supabase.com/dashboard and select your ShoutOut project)*

---

### **Step 2: Navigate to Edge Functions**

1. In the left sidebar, click **"Edge Functions"**
2. Click **"Create a new function"** button

---

### **Step 3: Create the Function**

1. **Function name**: `send-email`
2. **Click "Create function"**

---

### **Step 4: Add the Code**

Copy and paste this code into the editor:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailRequest {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { to, subject, html, from = 'ShoutOut <noreply@mail.shoutout.us>' }: EmailRequest = await req.json()

    const MAILGUN_API_KEY = Deno.env.get('MAILGUN_API_KEY')
    const MAILGUN_DOMAIN = Deno.env.get('MAILGUN_DOMAIN') || 'mail.shoutout.us'

    if (!MAILGUN_API_KEY) {
      throw new Error('MAILGUN_API_KEY not configured')
    }

    const formData = new FormData()
    formData.append('from', from)
    formData.append('to', to)
    formData.append('subject', subject)
    formData.append('html', html)

    const mailgunUrl = `https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`
    const auth = btoa(`api:${MAILGUN_API_KEY}`)

    const response = await fetch(mailgunUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
      },
      body: formData
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Mailgun API Error:', errorText)
      throw new Error(`Mailgun API error: ${response.statusText}`)
    }

    const result = await response.json()

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Email sent successfully',
        messageId: result.id 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
```

Click **"Save"** or **"Deploy"**

---

### **Step 5: Set Environment Secrets**

1. In the **Edge Functions** section, find your `send-email` function
2. Click on it to open details
3. Go to **"Secrets"** or **"Settings"** tab
4. Add these secrets:

```
MAILGUN_API_KEY = REDACTED_MAILGUN_KEY
MAILGUN_DOMAIN = mail.shoutout.us
```

---

### **Step 6: Test the Function**

1. Go to your app: https://shoutout.us/email-test
2. Click **"Send Test Email to hello@shoutout.us"**
3. Check your email inbox

---

## ✅ **That's It!**

Once deployed, the edge function will:
- ✅ Send emails from `noreply@mail.shoutout.us`
- ✅ Handle all notification emails
- ✅ Work securely with no exposed API keys
- ✅ Scale automatically

## 🔍 **Troubleshooting:**

If emails don't send:
1. Check **Edge Function Logs** in Supabase Dashboard
2. Verify secrets are set correctly
3. Make sure Mailgun domain is verified
4. Check function is deployed and enabled

---

**Follow these steps in the Supabase Dashboard and your email system will be live!** 📧✨


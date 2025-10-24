# Supabase Edge Functions for ShoutOut

## Setup Instructions

### 1. Install Supabase CLI

```bash
npm install -g supabase
```

### 2. Link to Your Supabase Project

```bash
supabase link --project-ref YOUR_PROJECT_REF
```

### 3. Set Edge Function Secrets

```bash
supabase secrets set MAILGUN_API_KEY=your_mailgun_api_key
supabase secrets set MAILGUN_DOMAIN=mail.shoutout.us
```

### 4. Deploy Edge Function

```bash
supabase functions deploy send-email
```

### 5. Verify Deployment

The function will be available at:
```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-email
```

## Testing

### Test from Command Line:

```bash
curl -X POST \
  'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-email' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "to": "hello@shoutout.us",
    "subject": "Test Email",
    "html": "<h1>Test</h1><p>This is a test email from Supabase Edge Function</p>"
  }'
```

### Test from Frontend:

Visit: `https://shoutout.us/email-test` and click the send button.

## Functions

### send-email

**Purpose**: Send emails via Mailgun API server-side

**Endpoint**: `/functions/v1/send-email`

**Method**: POST

**Body**:
```json
{
  "to": "recipient@example.com",
  "subject": "Email subject",
  "html": "<html>Email body</html>",
  "from": "ShoutOut <noreply@mail.shoutout.us>" // optional
}
```

**Response**:
```json
{
  "success": true,
  "message": "Email sent successfully",
  "messageId": "mailgun-message-id"
}
```

## Environment Variables

Set these in Supabase Edge Function secrets (not in .env):

- `MAILGUN_API_KEY`: Your Mailgun API key
- `MAILGUN_DOMAIN`: mail.shoutout.us

## Security

- ✅ API keys stay server-side (secure)
- ✅ No CORS issues (server-to-server)
- ✅ Rate limiting handled by Supabase
- ✅ Logs available in Supabase dashboard

## Monitoring

View logs in Supabase Dashboard:
1. Go to Edge Functions
2. Click on `send-email`
3. View logs and invocations

## Cost

Supabase Edge Functions:
- First 500,000 invocations/month: FREE
- After that: $2 per 1M invocations

Mailgun:
- Check your Mailgun plan for email sending limits


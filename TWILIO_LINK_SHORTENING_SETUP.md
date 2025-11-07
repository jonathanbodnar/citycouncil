# Twilio Link Shortening Setup

This guide explains how to enable Twilio's link shortening for SMS notifications to stay within the 160 character limit.

## Prerequisites

1. ✅ Verified domain with Twilio for short links
2. ✅ Twilio account with SMS capabilities
3. Twilio Messaging Service (see setup below)

## Setup Steps

### 1. Create a Messaging Service in Twilio

1. Log into your [Twilio Console](https://console.twilio.com/)
2. Navigate to **Messaging** → **Services**
3. Click **Create Messaging Service**
4. Configure:
   - **Friendly Name**: `ShoutOut SMS`
   - **Use Case**: Select "Notify my users"
5. Click **Create**
6. In the **Sender Pool** tab, add your Twilio phone number
7. In the **Integration** tab, configure:
   - **Process Inbound Messages**: Enable if needed
   - **Link Shortening**: Enable this option ✓
8. Copy the **Messaging Service SID** (starts with `MG...`)

### 2. Configure Link Shortening Domain

1. In your Messaging Service, go to **Messaging** → **Link Shortening**
2. Verify your domain is listed and active
3. Select your verified domain as the shortening domain
4. Save changes

### 3. Add Environment Variable to Supabase

You need to add the Messaging Service SID to your Supabase Edge Functions:

```bash
# Option 1: Via Supabase Dashboard
# 1. Go to Project Settings → Edge Functions
# 2. Add new secret:
#    Name: TWILIO_MESSAGING_SERVICE_SID
#    Value: MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Option 2: Via Supabase CLI
supabase secrets set TWILIO_MESSAGING_SERVICE_SID=MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 4. Test the Integration

After setting the environment variable:

1. Go to **Admin** → **Notifications** in your ShoutOut admin panel
2. Enable SMS for "Talent: New Order"
3. Create a test order
4. Check the Twilio logs to verify:
   - URL shortening is working
   - Message length is reduced
   - Links are using your verified domain

## How It Works

### Before (No Shortening)
```
Hey John, you got a new ShoutOut order, fulfill here: https://app.shoutout.com/fulfill/a1b2c3d4-e5f6-7890-abcd-ef1234567890
```
**Length**: ~140 characters (just for the URL!)

### After (With Shortening)
```
Hey John, you got a new ShoutOut order, fulfill here: https://yourdomain.com/abc123
```
**Length**: ~80 characters total (saves ~60 characters!)

## Technical Details

### Edge Function: `send-sms`

The function now:
1. Extracts all URLs from the SMS message using regex
2. Calls Twilio's ShortUrls API for each URL
3. Replaces long URLs with shortened versions
4. Sends the SMS with shortened links
5. Falls back to long URLs if shortening fails

### API Endpoint Used

```
POST https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/Messages/Services/{MessagingServiceSid}/ShortUrls.json
Body: Url={long_url}
```

### Response Example

```json
{
  "sid": "XYabc123...",
  "account_sid": "AC...",
  "messaging_service_sid": "MG...",
  "url": "https://app.shoutout.com/fulfill/...",
  "short_url": "https://yourdomain.com/abc123",
  "date_created": "2025-01-14T..."
}
```

## Benefits

1. **Stay within 160 characters**: More room for personalized messages
2. **Better deliverability**: Longer messages = multiple segments = higher cost
3. **Professional appearance**: Clean, branded short links
4. **Click tracking**: Twilio provides analytics on link clicks
5. **Automatic**: Works for all SMS notifications across the platform

## Environment Variables Required

```bash
# Existing (required)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# New (for link shortening)
TWILIO_MESSAGING_SERVICE_SID=MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## Fallback Behavior

If link shortening fails or is not configured:
- The function will send the SMS with the original long URL
- No errors are thrown to the user
- The SMS still gets delivered
- Check logs for any shortening errors

## Cost Considerations

- Twilio charges per SMS segment (160 characters)
- Long URLs can push messages into multiple segments
- Link shortening reduces cost by keeping messages in 1 segment
- Short links are cached and reused by Twilio

## Troubleshooting

### Links not being shortened?

1. Check `TWILIO_MESSAGING_SERVICE_SID` is set correctly
2. Verify domain is active in Twilio Console
3. Check Edge Function logs for errors
4. Ensure Messaging Service has link shortening enabled

### SMS not sending?

1. The function falls back to `TWILIO_PHONE_NUMBER` if Messaging Service isn't configured
2. Check all Twilio credentials are set correctly
3. Review Twilio Console logs

### Getting 404 on short links?

1. Ensure domain is verified and active in Twilio
2. Check domain DNS settings
3. Wait a few minutes after domain verification

## Testing

Test the shortening manually:

```bash
# Using curl (replace with your credentials)
curl -X POST "https://api.twilio.com/2010-04-01/Accounts/ACxxx/Messages/Services/MGxxx/ShortUrls.json" \
  -u "ACxxx:your_auth_token" \
  -d "Url=https://app.shoutout.com/fulfill/a1b2c3d4-e5f6-7890-abcd-ef1234567890"
```

Expected response includes `short_url` field.

## Next Steps

After setup is complete:
1. ✅ Deploy the updated `send-sms` edge function (already done)
2. ⏳ Add `TWILIO_MESSAGING_SERVICE_SID` to Supabase secrets
3. ⏳ Test by creating an order and checking SMS length
4. ⏳ Monitor Twilio logs to verify shortening is working


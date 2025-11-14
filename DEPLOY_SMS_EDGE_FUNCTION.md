# 🚀 Deploy send-mass-sms Edge Function

## Quick Deploy

```bash
cd supabase/functions
supabase functions deploy send-mass-sms --no-verify-jwt
```

## What It Does

The `send-mass-sms` Edge Function:
- ✅ Verifies admin access
- ✅ Gets recipients based on segment (beta, registered, all, talent)
- ✅ Creates SMS campaign record
- ✅ Sends SMS via Twilio (rate-limited to 10/sec)
- ✅ Logs each SMS delivery
- ✅ Updates campaign status

## Security

- **Admin-only**: Checks `user_type = 'admin'` before sending
- **Rate Limited**: 10 SMS per second (100ms delay)
- **Logging**: Every SMS logged to `sms_logs` table
- **Campaign Tracking**: Full audit trail in `sms_campaigns` table

## Required Environment Variables

Make sure these are set in Supabase:

```bash
TWILIO_ACCOUNT_SID=ACxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1XXXXXXXXXX
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Testing

### Test with Postman or curl:

```bash
curl -X POST https://your-project.supabase.co/functions/v1/send-mass-sms \
  -H "Authorization: Bearer YOUR_SUPABASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "campaign_name": "Test Campaign",
    "message": "This is a test message",
    "target_audience": "beta"
  }'
```

### Expected Response:

```json
{
  "success": true,
  "campaign_id": "uuid",
  "sent_count": 5,
  "failed_count": 0,
  "total": 5
}
```

## Error Handling

### Common Errors:

1. **"Missing authorization"** - No auth token provided
2. **"Admin access required"** - User is not an admin
3. **"No recipients found"** - Selected segment has no users
4. **"Message must be 160 characters or less"** - Message too long

### Twilio Errors:
- Logged to `sms_logs` table with `status = 'failed'`
- `error_message` field contains Twilio error
- Campaign continues sending to other recipients

## Rate Limiting

- **10 SMS per second** (100ms delay between sends)
- Well under Twilio's limit (1000 SMS/sec for verified senders)
- Prevents overwhelming Twilio API
- Ensures reliable delivery

## Monitoring

### Check Campaign Status:
```sql
SELECT 
  campaign_name,
  target_audience,
  recipient_count,
  sent_count,
  failed_count,
  status,
  created_at
FROM sms_campaigns
ORDER BY created_at DESC
LIMIT 10;
```

### Check Individual SMS Logs:
```sql
SELECT 
  phone_number,
  message,
  status,
  error_message,
  sent_at
FROM sms_logs
WHERE campaign_id = 'your-campaign-id'
ORDER BY sent_at DESC;
```

### Check Failed SMS:
```sql
SELECT 
  phone_number,
  error_message,
  sent_at
FROM sms_logs
WHERE status = 'failed'
ORDER BY sent_at DESC;
```

## Troubleshooting

### Function not found:
```bash
# Redeploy
supabase functions deploy send-mass-sms --no-verify-jwt
```

### Twilio errors:
- Check `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` are correct
- Verify `TWILIO_PHONE_NUMBER` is in E.164 format (+1XXXXXXXXXX)
- Ensure phone number is verified in Twilio (for trial accounts)

### Database errors:
- Verify `get_users_by_segment()` function exists
- Check `sms_campaigns` and `sms_logs` tables exist
- Verify RLS policies allow admin access

## Success! 🎉

Once deployed, the SMS Management UI in Comms Center will be fully functional.

Admins can:
- ✅ View beta subscribers
- ✅ View registered users  
- ✅ Send mass SMS to any segment
- ✅ Track delivery in real-time
- ✅ View campaign history


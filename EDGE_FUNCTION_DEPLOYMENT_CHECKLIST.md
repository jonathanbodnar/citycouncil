# Edge Function Deployment Checklist

For the email flow to work automatically, the `process-email-flows` edge function must be deployed and configured correctly.

## ✅ Deployment Checklist

### 1. **Deploy the Edge Function**
```bash
cd supabase/functions
supabase functions deploy process-email-flows
```

### 2. **Set Environment Variables**
The edge function needs these secrets:
- `SENDGRID_API_KEY` - Your SendGrid API key

```bash
# Set SendGrid API key
supabase secrets set SENDGRID_API_KEY=your_sendgrid_api_key_here
```

### 3. **Verify Deployment**
Go to Supabase Dashboard → Edge Functions → `process-email-flows`

Should show:
- ✅ Deployed
- ✅ Version number
- ✅ Last deployed date

### 4. **Test the Function Manually**
In Supabase SQL Editor:
```sql
SELECT invoke_process_email_flows();
```

Should return success and not error.

### 5. **Check Function Logs**
Go to Supabase Dashboard → Edge Functions → `process-email-flows` → Logs

Look for:
- ✅ "📧 Processing email flows..."
- ✅ "📬 Found X users due for emails"
- ✅ "📤 Sending email to..."
- ✅ "✅ Email processing complete"

### 6. **Verify Cron Job**
```sql
-- Check cron job exists and is active
SELECT * FROM cron.job WHERE jobname = 'process-email-flows';

-- Check recent runs
SELECT status, start_time, return_message 
FROM cron.job_run_details 
WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname = 'process-email-flows')
ORDER BY start_time DESC 
LIMIT 5;
```

## 🔍 Troubleshooting

### If cron job shows "failed":
1. Check if `invoke_process_email_flows()` function exists
2. Run `FIX_ALL_EMAIL_FLOWS.sql`
3. Check edge function logs for errors

### If emails don't send:
1. Verify SendGrid API key is set
2. Check SendGrid dashboard for bounces/blocks
3. Check edge function logs
4. Verify email flow messages exist in database

### If "edge function not found":
1. Deploy the function: `supabase functions deploy process-email-flows`
2. Verify in Supabase Dashboard → Edge Functions

## 📊 How to Verify Everything Works

Run this test:
```sql
-- File: database/TEST_BIO_SUBSCRIPTION_FLOW.sql
-- This simulates a bio page subscription and sends email immediately
```

Should see:
- ✅ User enrolled
- ✅ Email processing triggered
- ✅ Email sent successfully

## 🚀 Once Working

The flow is fully automatic:
1. User subscribes on `bio.shoutout.us/[talent]`
2. Bio app calls `capture-lead` edge function
3. `capture-lead` enrolls user in email flow
4. Cron job runs every 5 minutes
5. `process-email-flows` sends pending emails
6. User receives welcome email

No manual intervention needed! ✨


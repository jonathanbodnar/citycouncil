-- Check if jonathanbagwell23@gmail.com email was sent

-- 1. Check email flow enrollment status
SELECT 
  '1️⃣ Email Flow Enrollment' as check_name,
  email,
  flow_id,
  current_message_order,
  last_email_sent_at,
  next_email_scheduled_at,
  is_paused,
  flow_completed_at,
  source_talent_slug
FROM user_email_flow_status
WHERE email = 'jonathanbagwell23@gmail.com';

-- 2. Check email send log (most recent attempts)
SELECT 
  '2️⃣ Email Send Log' as check_name,
  subject,
  status,
  error_message,
  sent_at,
  opened_at,
  clicked_at
FROM email_send_log
WHERE email = 'jonathanbagwell23@gmail.com'
ORDER BY sent_at DESC
LIMIT 5;

-- 3. Check recent cron job runs
SELECT 
  '3️⃣ Cron Job Status' as check_name,
  status,
  LEFT(return_message, 100) as message,
  start_time,
  end_time
FROM cron.job_run_details
WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname = 'process-email-flows')
ORDER BY start_time DESC
LIMIT 3;

-- 4. Summary
SELECT 
  '📊 SUMMARY' as info,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM email_send_log 
      WHERE email = 'jonathanbagwell23@gmail.com' 
        AND status = 'sent'
    ) THEN '✅ EMAIL SENT SUCCESSFULLY'
    WHEN EXISTS (
      SELECT 1 FROM email_send_log 
      WHERE email = 'jonathanbagwell23@gmail.com' 
        AND status = 'failed'
    ) THEN '❌ EMAIL FAILED TO SEND'
    WHEN EXISTS (
      SELECT 1 FROM user_email_flow_status 
      WHERE email = 'jonathanbagwell23@gmail.com'
        AND next_email_scheduled_at > NOW()
    ) THEN '⏳ EMAIL SCHEDULED FOR FUTURE'
    WHEN NOT EXISTS (
      SELECT 1 FROM user_email_flow_status 
      WHERE email = 'jonathanbagwell23@gmail.com'
    ) THEN '🔴 NOT ENROLLED IN ANY FLOW'
    ELSE '⚠️ UNKNOWN STATUS'
  END as status;


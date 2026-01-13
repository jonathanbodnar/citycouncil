-- Check if FIX_ALL_EMAIL_FLOWS.sql was actually run

-- 1. Check if the invoke function exists
SELECT 
  '1️⃣ Email Processing Function' as check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_proc 
      WHERE proname = 'invoke_process_email_flows'
    ) THEN '✅ Function EXISTS'
    ELSE '❌ Function MISSING - Run FIX_ALL_EMAIL_FLOWS.sql'
  END as status;

-- 2. Check if cron job exists
SELECT 
  '2️⃣ Cron Job' as check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM cron.job 
      WHERE jobname = 'process-email-flows'
    ) THEN '✅ Cron job EXISTS and is: ' || 
      CASE WHEN active THEN 'ACTIVE ✅' ELSE 'INACTIVE ❌' END
    ELSE '❌ Cron job MISSING'
  END as status
FROM cron.job
WHERE jobname = 'process-email-flows'
UNION ALL
SELECT '2️⃣ Cron Job', '❌ Cron job MISSING - Run FIX_ALL_EMAIL_FLOWS.sql'
WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-email-flows');

-- 3. Check if post-purchase flow has messages
SELECT 
  '3️⃣ Post-Purchase Emails' as check_name,
  CASE 
    WHEN COUNT(*) = 5 THEN '✅ All 5 emails configured'
    WHEN COUNT(*) > 0 THEN '⚠️ Only ' || COUNT(*) || ' emails (should be 5)'
    ELSE '❌ NO EMAILS - Run FIX_ALL_EMAIL_FLOWS.sql'
  END as status
FROM email_flow_messages
WHERE flow_id = 'bbbb5555-5555-5555-5555-555555555555';

-- 4. Check if talent connection flow exists and has messages
SELECT 
  '4️⃣ Talent Connection Emails' as check_name,
  CASE 
    WHEN COUNT(*) >= 1 THEN '✅ ' || COUNT(*) || ' emails configured'
    ELSE '❌ NO EMAILS - Run migrations/20250112_talent_connection_email_flow.sql'
  END as status
FROM email_flow_messages
WHERE flow_id = 'aaaa1111-1111-1111-1111-111111111111';

-- Final verdict
SELECT 
  '📊 VERDICT' as check_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'invoke_process_email_flows')
     AND EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-email-flows')
     AND EXISTS (SELECT 1 FROM email_flow_messages WHERE flow_id = 'bbbb5555-5555-5555-5555-555555555555')
    THEN '✅ FIX_ALL_EMAIL_FLOWS.sql WAS RUN - System is configured'
    ELSE '❌ FIX_ALL_EMAIL_FLOWS.sql NOT RUN - Run it now!'
  END as status;


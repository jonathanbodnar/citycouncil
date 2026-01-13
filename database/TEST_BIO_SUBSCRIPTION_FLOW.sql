-- Complete test of bio page subscription → email flow
-- This simulates what happens when a user subscribes on bio.shoutout.us

-- =================================================================
-- PART 1: VERIFY THE SYSTEM IS SET UP CORRECTLY
-- =================================================================

-- Check 1: Email processing function exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'invoke_process_email_flows') THEN
    RAISE EXCEPTION '❌ CRITICAL: invoke_process_email_flows function does not exist. You must run FIX_ALL_EMAIL_FLOWS.sql first!';
  END IF;
  RAISE NOTICE '✅ Email processing function exists';
END $$;

-- Check 2: Cron job is configured
DO $$
DECLARE
  v_job_active BOOLEAN;
BEGIN
  SELECT active INTO v_job_active 
  FROM cron.job 
  WHERE jobname = 'process-email-flows';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION '❌ CRITICAL: Cron job "process-email-flows" does not exist. You must run FIX_ALL_EMAIL_FLOWS.sql first!';
  END IF;
  
  IF NOT v_job_active THEN
    RAISE WARNING '⚠️ WARNING: Cron job exists but is NOT ACTIVE';
  ELSE
    RAISE NOTICE '✅ Cron job is active and running every 5 minutes';
  END IF;
END $$;

-- Check 3: Talent connection flow has messages
DO $$
DECLARE
  v_message_count INT;
BEGIN
  SELECT COUNT(*) INTO v_message_count
  FROM email_flow_messages
  WHERE flow_id = 'aaaa1111-1111-1111-1111-111111111111'
    AND is_active = true;
  
  IF v_message_count = 0 THEN
    RAISE EXCEPTION '❌ CRITICAL: Talent connection flow has NO messages. You must run migrations/20250112_talent_connection_email_flow.sql first!';
  END IF;
  
  RAISE NOTICE '✅ Talent connection flow has % message(s)', v_message_count;
END $$;

-- Check 4: Recent cron job runs
DO $$
DECLARE
  v_last_status TEXT;
  v_last_run TIMESTAMPTZ;
BEGIN
  SELECT status, start_time 
  INTO v_last_status, v_last_run
  FROM cron.job_run_details
  WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname = 'process-email-flows')
  ORDER BY start_time DESC
  LIMIT 1;
  
  IF v_last_status IS NULL THEN
    RAISE NOTICE '⚠️ Cron job has never run yet (this is normal if just set up)';
  ELSIF v_last_status = 'failed' THEN
    RAISE WARNING '❌ Last cron job run FAILED at %. Check the error!', v_last_run;
  ELSE
    RAISE NOTICE '✅ Last cron job run succeeded at %', v_last_run;
  END IF;
END $$;

RAISE NOTICE '';
RAISE NOTICE '=================================================================';
RAISE NOTICE 'PART 2: SIMULATE BIO PAGE SUBSCRIPTION';
RAISE NOTICE '=================================================================';
RAISE NOTICE '';

-- =================================================================
-- PART 2: SIMULATE WHAT HAPPENS WHEN USER SUBSCRIBES
-- =================================================================

-- Simulate: User subscribes on bio.shoutout.us/meloniemac
-- The bio app calls capture-lead edge function which enrolls them

DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get the user ID (they should already exist)
  SELECT id INTO v_user_id FROM users WHERE email = 'jonathanbagwell23@gmail.com';
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '❌ User jonathanbagwell23@gmail.com does not exist';
  END IF;
  
  RAISE NOTICE '✅ Found user: jonathanbagwell23@gmail.com (ID: %)', v_user_id;
  
  -- Simulate capture-lead enrollment
  INSERT INTO user_email_flow_status (
    email,
    user_id,
    flow_id,
    current_message_order,
    next_email_scheduled_at,
    flow_started_at,
    source_talent_slug,
    is_paused,
    unsubscribed
  ) VALUES (
    'jonathanbagwell23@gmail.com',
    v_user_id,
    'aaaa1111-1111-1111-1111-111111111111',
    0,
    NOW(), -- Send immediately (cron job will pick it up in next 5 min)
    NOW(),
    'meloniemac',
    false,
    false
  )
  ON CONFLICT (email, flow_id) DO UPDATE SET
    next_email_scheduled_at = NOW(),
    is_paused = false,
    unsubscribed = false;
  
  RAISE NOTICE '✅ User enrolled in talent_connection flow';
  RAISE NOTICE '   - Flow ID: aaaa1111-1111-1111-1111-111111111111';
  RAISE NOTICE '   - Talent: meloniemac';
  RAISE NOTICE '   - Next email scheduled: NOW (will be processed by cron)';
END $$;

RAISE NOTICE '';
RAISE NOTICE '=================================================================';
RAISE NOTICE 'PART 3: TRIGGER EMAIL PROCESSING MANUALLY';
RAISE NOTICE '=================================================================';
RAISE NOTICE '';

-- =================================================================
-- PART 3: MANUALLY TRIGGER EMAIL PROCESSING (DON'T WAIT FOR CRON)
-- =================================================================

SELECT invoke_process_email_flows();

RAISE NOTICE '✅ Email processing triggered';

-- Wait a moment for processing
SELECT pg_sleep(2);

-- =================================================================
-- PART 4: CHECK IF EMAIL WAS SENT
-- =================================================================

RAISE NOTICE '';
RAISE NOTICE '=================================================================';
RAISE NOTICE 'PART 4: CHECK RESULTS';
RAISE NOTICE '=================================================================';
RAISE NOTICE '';

DO $$
DECLARE
  v_email_sent BOOLEAN;
  v_email_failed BOOLEAN;
  v_error_msg TEXT;
BEGIN
  -- Check if email was sent
  SELECT EXISTS (
    SELECT 1 FROM email_send_log 
    WHERE email = 'jonathanbagwell23@gmail.com' 
      AND status = 'sent'
  ) INTO v_email_sent;
  
  -- Check if email failed
  SELECT 
    EXISTS (SELECT 1 FROM email_send_log WHERE email = 'jonathanbagwell23@gmail.com' AND status = 'failed'),
    (SELECT error_message FROM email_send_log WHERE email = 'jonathanbagwell23@gmail.com' AND status = 'failed' ORDER BY sent_at DESC LIMIT 1)
  INTO v_email_failed, v_error_msg;
  
  IF v_email_sent THEN
    RAISE NOTICE '✅ ✅ ✅ SUCCESS! Email was sent to jonathanbagwell23@gmail.com';
  ELSIF v_email_failed THEN
    RAISE NOTICE '❌ Email FAILED to send. Error: %', v_error_msg;
  ELSE
    RAISE NOTICE '⚠️ Email has not been processed yet. This could mean:';
    RAISE NOTICE '   1. The cron job needs to run (wait up to 5 minutes)';
    RAISE NOTICE '   2. The edge function is not deployed';
    RAISE NOTICE '   3. There is an error in the edge function';
  END IF;
END $$;

-- Show detailed results
SELECT 
  '📧 Email Flow Status' as section,
  email,
  current_message_order,
  last_email_sent_at,
  next_email_scheduled_at,
  is_paused
FROM user_email_flow_status
WHERE email = 'jonathanbagwell23@gmail.com';

SELECT 
  '📨 Email Send Log' as section,
  subject,
  status,
  error_message,
  sent_at
FROM email_send_log
WHERE email = 'jonathanbagwell23@gmail.com'
ORDER BY sent_at DESC
LIMIT 3;

-- =================================================================
-- FINAL VERDICT
-- =================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'SUMMARY';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'If email was sent successfully:';
  RAISE NOTICE '  ✅ The system is working! Bio subscriptions will now send emails automatically';
  RAISE NOTICE '';
  RAISE NOTICE 'If email failed or not processed:';
  RAISE NOTICE '  1. Check if process-email-flows edge function is deployed in Supabase dashboard';
  RAISE NOTICE '  2. Check edge function logs for errors';
  RAISE NOTICE '  3. Verify SendGrid API key is set in edge function secrets';
  RAISE NOTICE '';
END $$;


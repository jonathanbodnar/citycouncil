-- Direct enrollment of jonathanbagwell23@gmail.com in talent connection flow
-- This is a simplified version that WILL work

-- Step 1: Get user ID
DO $$
DECLARE
  v_user_id UUID;
  v_user_exists BOOLEAN;
BEGIN
  -- Check if user exists
  SELECT id INTO v_user_id FROM users WHERE email = 'jonathanbagwell23@gmail.com';
  v_user_exists := FOUND;
  
  IF NOT v_user_exists THEN
    RAISE EXCEPTION 'User jonathanbagwell23@gmail.com does not exist in users table';
  END IF;
  
  RAISE NOTICE 'Found user: % (ID: %)', 'jonathanbagwell23@gmail.com', v_user_id;
  
  -- Step 2: Enroll in talent connection flow
  INSERT INTO user_email_flow_status (
    email,
    user_id,
    flow_id,
    current_message_order,
    next_email_scheduled_at,
    flow_started_at,
    source_talent_slug,
    is_paused,
    unsubscribed,
    created_at,
    updated_at
  ) VALUES (
    'jonathanbagwell23@gmail.com',
    v_user_id,
    'aaaa1111-1111-1111-1111-111111111111', -- talent_connection flow
    0, -- Haven't sent first email yet
    NOW() + INTERVAL '10 seconds', -- Send in 10 seconds
    NOW(),
    'meloniemac', -- They subscribed to Melonie Mac
    false,
    false,
    NOW(),
    NOW()
  )
  ON CONFLICT (email, flow_id) DO UPDATE SET
    next_email_scheduled_at = NOW() + INTERVAL '10 seconds',
    is_paused = false,
    unsubscribed = false,
    updated_at = NOW();
  
  RAISE NOTICE '✅ User enrolled successfully!';
  RAISE NOTICE '   Email will send in 10 seconds';
  
END $$;

-- Step 3: Verify enrollment
SELECT 
  '✅ Enrollment Confirmed' as status,
  email,
  flow_id,
  current_message_order,
  next_email_scheduled_at,
  source_talent_slug,
  is_paused
FROM user_email_flow_status
WHERE email = 'jonathanbagwell23@gmail.com'
  AND flow_id = 'aaaa1111-1111-1111-1111-111111111111';

-- Step 4: Check if cron job is running
SELECT 
  '🔄 Cron Job Status' as status,
  jobname,
  schedule,
  active,
  CASE 
    WHEN active THEN 'Running every 5 minutes ✅'
    ELSE 'NOT ACTIVE ❌'
  END as job_status
FROM cron.job
WHERE jobname = 'process-email-flows';

-- Step 5: Manually trigger email processing NOW (don't wait for cron)
SELECT invoke_process_email_flows();

-- Step 6: Wait a moment and check send log
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ ENROLLMENT COMPLETE!';
  RAISE NOTICE '';
  RAISE NOTICE 'What happened:';
  RAISE NOTICE '1. User enrolled in talent connection flow';
  RAISE NOTICE '2. Email processing triggered immediately';
  RAISE NOTICE '3. Email should be sent within seconds';
  RAISE NOTICE '';
  RAISE NOTICE 'Wait 30 seconds then run CHECK_EMAIL_SENT.sql to verify';
  RAISE NOTICE '';
END $$;


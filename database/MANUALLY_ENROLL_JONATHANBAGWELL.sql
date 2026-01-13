-- Manually enroll jonathanbagwell23@gmail.com in talent connection email flow
-- Run this ONLY AFTER running CHECK_JONATHANBAGWELL_EMAIL.sql to confirm enrollment is missing

-- First, verify user exists
DO $$
DECLARE
  v_user_id UUID;
  v_existing_enrollment UUID;
BEGIN
  -- Get user ID
  SELECT id INTO v_user_id
  FROM users
  WHERE email = 'jonathanbagwell23@gmail.com';

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found: jonathanbagwell23@gmail.com';
  END IF;

  RAISE NOTICE 'Found user ID: %', v_user_id;

  -- Check if already enrolled
  SELECT id INTO v_existing_enrollment
  FROM user_email_flow_status
  WHERE email = 'jonathanbagwell23@gmail.com'
    AND flow_id = 'aaaa1111-1111-1111-1111-111111111111';

  IF v_existing_enrollment IS NOT NULL THEN
    RAISE NOTICE 'User is already enrolled in talent connection flow. Enrollment ID: %', v_existing_enrollment;
    
    -- If they're enrolled but email hasn't sent, reset the schedule
    UPDATE user_email_flow_status
    SET 
      next_email_scheduled_at = NOW() + INTERVAL '30 seconds',
      is_paused = false,
      updated_at = NOW()
    WHERE id = v_existing_enrollment
      AND current_message_order = 0; -- Only if they haven't received first email yet
    
    RAISE NOTICE 'Reset email schedule to send in 30 seconds';
  ELSE
    -- Enroll them now
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
      'aaaa1111-1111-1111-1111-111111111111', -- talent_connection flow
      0,
      NOW() + INTERVAL '30 seconds', -- Send first email in 30 seconds
      NOW(),
      'meloniemac', -- They subscribed to Melonie Mac
      false,
      false
    );
    
    RAISE NOTICE 'User enrolled successfully. First email will send in 30 seconds.';
  END IF;
END $$;

-- Verify enrollment
SELECT 
  'Enrollment Status' as check_type,
  email,
  flow_id,
  current_message_order,
  next_email_scheduled_at,
  source_talent_slug,
  is_paused
FROM user_email_flow_status
WHERE email = 'jonathanbagwell23@gmail.com'
  AND flow_id = 'aaaa1111-1111-1111-1111-111111111111';


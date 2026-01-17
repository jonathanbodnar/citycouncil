-- Fix Email & SMS Flow Enrollment Issues
-- Run this in Supabase SQL editor

-- ===========================================
-- PART 1: Diagnose current state
-- ===========================================

-- Check email flows status
SELECT 
  id, 
  name, 
  display_name, 
  is_active,
  trigger_type
FROM email_flows
ORDER BY name;

-- Check talent_connection flow specifically
SELECT 
  ef.id,
  ef.name,
  ef.display_name,
  ef.is_active,
  COUNT(efm.id) as message_count
FROM email_flows ef
LEFT JOIN email_flow_messages efm ON efm.flow_id = ef.id AND efm.is_active = true
WHERE ef.id = 'aaaa1111-1111-1111-1111-111111111111'
GROUP BY ef.id, ef.name, ef.display_name, ef.is_active;

-- Check SMS flows status  
SELECT 
  id,
  name,
  description,
  is_active,
  trigger_type
FROM sms_flows
ORDER BY name;

-- Check bi-weekly (giveaway_ongoing) flow
SELECT 
  sf.id,
  sf.name,
  sf.is_active,
  COUNT(sfm.id) as message_count
FROM sms_flows sf
LEFT JOIN sms_flow_messages sfm ON sfm.flow_id = sf.id AND sfm.is_active = true
WHERE sf.id = '33333333-3333-3333-3333-333333333333'
GROUP BY sf.id, sf.name, sf.is_active;

-- ===========================================
-- PART 2: Ensure flows are active
-- ===========================================

-- Activate talent_connection email flow if not active
UPDATE email_flows 
SET is_active = true
WHERE id = 'aaaa1111-1111-1111-1111-111111111111';

-- Activate bi-weekly SMS flow if not active
UPDATE sms_flows 
SET is_active = true
WHERE id = '33333333-3333-3333-3333-333333333333';

-- ===========================================
-- PART 3: Check users enrolled in flows
-- ===========================================

-- Users enrolled in talent_connection email flow
SELECT 
  COUNT(*) as enrolled_count,
  COUNT(CASE WHEN flow_completed_at IS NULL THEN 1 END) as active_count,
  COUNT(CASE WHEN flow_completed_at IS NOT NULL THEN 1 END) as completed_count
FROM user_email_flow_status
WHERE flow_id = 'aaaa1111-1111-1111-1111-111111111111';

-- Users enrolled in bi-weekly SMS flow
SELECT 
  COUNT(*) as enrolled_count,
  COUNT(CASE WHEN flow_completed_at IS NULL THEN 1 END) as active_count,
  COUNT(CASE WHEN flow_completed_at IS NOT NULL THEN 1 END) as completed_count
FROM user_sms_flow_status
WHERE flow_id = '33333333-3333-3333-3333-333333333333';

-- ===========================================
-- PART 4: Backfill talent followers into email flow
-- This enrolls existing talent followers who weren't enrolled before
-- ===========================================

-- Create a function to enroll a user in the talent_connection email flow
CREATE OR REPLACE FUNCTION enroll_user_in_talent_connection_flow(
  p_email TEXT,
  p_user_id UUID,
  p_talent_slug TEXT
)
RETURNS void AS $$
DECLARE
  v_first_message RECORD;
  v_next_scheduled_at TIMESTAMPTZ;
BEGIN
  -- Check if already enrolled
  IF EXISTS (
    SELECT 1 FROM user_email_flow_status 
    WHERE email = p_email 
    AND flow_id = 'aaaa1111-1111-1111-1111-111111111111'
  ) THEN
    RETURN; -- Already enrolled
  END IF;

  -- Get first message delay
  SELECT delay_minutes, delay_hours, delay_days 
  INTO v_first_message
  FROM email_flow_messages 
  WHERE flow_id = 'aaaa1111-1111-1111-1111-111111111111'
  AND sequence_order = 1 
  AND is_active = true;

  -- Calculate next scheduled time
  v_next_scheduled_at := NOW() 
    + (COALESCE(v_first_message.delay_days, 0) || ' days')::INTERVAL
    + (COALESCE(v_first_message.delay_hours, 0) || ' hours')::INTERVAL
    + (COALESCE(v_first_message.delay_minutes, 0) || ' minutes')::INTERVAL;

  -- Insert enrollment
  INSERT INTO user_email_flow_status (
    email,
    user_id,
    flow_id,
    current_message_order,
    next_email_scheduled_at,
    source_talent_slug,
    created_at
  ) VALUES (
    p_email,
    p_user_id,
    'aaaa1111-1111-1111-1111-111111111111',
    0,
    v_next_scheduled_at,
    p_talent_slug,
    NOW()
  );
  
  RAISE NOTICE 'Enrolled % in talent_connection flow', p_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backfill: Enroll existing talent followers from the last 30 days
-- who aren't already in the talent_connection email flow
DO $$
DECLARE
  r RECORD;
  enrolled_count INT := 0;
BEGIN
  FOR r IN 
    SELECT DISTINCT 
      u.email,
      u.id as user_id,
      tp.username as talent_slug
    FROM talent_followers tf
    JOIN users u ON u.id = tf.user_id
    JOIN talent_profiles tp ON tp.id = tf.talent_id
    WHERE u.email IS NOT NULL
    AND tf.created_at >= NOW() - INTERVAL '30 days'
    AND NOT EXISTS (
      SELECT 1 FROM user_email_flow_status uefs
      WHERE uefs.email = u.email 
      AND uefs.flow_id = 'aaaa1111-1111-1111-1111-111111111111'
    )
  LOOP
    PERFORM enroll_user_in_talent_connection_flow(r.email, r.user_id, r.talent_slug);
    enrolled_count := enrolled_count + 1;
  END LOOP;
  
  RAISE NOTICE 'Backfilled % users into talent_connection email flow', enrolled_count;
END $$;

-- ===========================================
-- PART 5: Check users who should be in bi-weekly SMS
-- Users who completed followup 7+ days ago but aren't in ongoing
-- ===========================================

-- Count users ready for bi-weekly but not enrolled
SELECT COUNT(*) as ready_for_biweekly
FROM user_sms_flow_status followup
WHERE followup.flow_id = '22222222-2222-2222-2222-222222222222' -- followup flow
AND followup.flow_completed_at IS NOT NULL
AND followup.flow_completed_at <= NOW() - INTERVAL '7 days'
AND NOT EXISTS (
  SELECT 1 FROM user_sms_flow_status ongoing
  WHERE ongoing.phone = followup.phone
  AND ongoing.flow_id = '33333333-3333-3333-3333-333333333333' -- ongoing flow
);

-- Backfill users into bi-weekly SMS flow
INSERT INTO user_sms_flow_status (phone, user_id, flow_id, current_message_order, next_message_scheduled_at, coupon_code)
SELECT 
  followup.phone,
  followup.user_id,
  '33333333-3333-3333-3333-333333333333', -- ongoing flow
  0,
  NOW(), -- Start immediately  
  followup.coupon_code
FROM user_sms_flow_status followup
WHERE followup.flow_id = '22222222-2222-2222-2222-222222222222'
AND followup.flow_completed_at IS NOT NULL
AND followup.flow_completed_at <= NOW() - INTERVAL '7 days'
AND NOT EXISTS (
  SELECT 1 FROM user_sms_flow_status ongoing
  WHERE ongoing.phone = followup.phone
  AND ongoing.flow_id = '33333333-3333-3333-3333-333333333333'
)
ON CONFLICT (phone, flow_id) DO NOTHING;

-- ===========================================
-- PART 6: Verify cron jobs are running
-- ===========================================

-- Check if email flow cron job exists
SELECT * FROM cron.job WHERE jobname LIKE '%email%';

-- Check if SMS flow cron job exists  
SELECT * FROM cron.job WHERE jobname LIKE '%sms%';

-- ===========================================
-- PART 7: Summary stats after fixes
-- ===========================================

SELECT 'EMAIL FLOWS' as flow_type, ef.name, ef.is_active,
  (SELECT COUNT(*) FROM user_email_flow_status WHERE flow_id = ef.id) as total_enrolled,
  (SELECT COUNT(*) FROM user_email_flow_status WHERE flow_id = ef.id AND flow_completed_at IS NULL) as active
FROM email_flows ef
ORDER BY ef.name;

SELECT 'SMS FLOWS' as flow_type, sf.name, sf.is_active,
  (SELECT COUNT(*) FROM user_sms_flow_status WHERE flow_id = sf.id) as total_enrolled,
  (SELECT COUNT(*) FROM user_sms_flow_status WHERE flow_id = sf.id AND flow_completed_at IS NULL) as active
FROM sms_flows sf
ORDER BY sf.name;

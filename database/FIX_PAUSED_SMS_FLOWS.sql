-- Investigate and Fix Paused SMS Flows
-- Run this in Supabase SQL editor

-- ===========================================
-- PART 1: Check why flows are paused
-- ===========================================

-- Count paused vs active bi-weekly flows
SELECT 
  is_paused,
  COUNT(*) as count
FROM user_sms_flow_status
WHERE flow_id = '33333333-3333-3333-3333-333333333333' -- bi-weekly engagement
GROUP BY is_paused;

-- Check metadata for pause reasons on paused flows
SELECT 
  phone,
  is_paused,
  metadata->>'pause_reason' as pause_reason,
  metadata->>'paused_at' as paused_at,
  next_message_scheduled_at,
  current_message_order
FROM user_sms_flow_status
WHERE flow_id = '33333333-3333-3333-3333-333333333333'
AND is_paused = true
LIMIT 20;

-- ===========================================
-- PART 2: Check SMS send log for failures
-- ===========================================

-- Recent failed SMS sends
SELECT 
  phone,
  status,
  error_message,
  sent_at
FROM sms_send_log
WHERE status = 'failed'
ORDER BY sent_at DESC
LIMIT 20;

-- ===========================================
-- PART 3: Check if the bi-weekly flow has messages
-- ===========================================

SELECT 
  id,
  sequence_order,
  LEFT(message_text, 50) as message_preview,
  delay_days,
  is_active
FROM sms_flow_messages
WHERE flow_id = '33333333-3333-3333-3333-333333333333'
ORDER BY sequence_order;

-- ===========================================
-- PART 4: UNPAUSE all bi-weekly engagement flows
-- These got paused due to previous send failures
-- ===========================================

UPDATE user_sms_flow_status
SET 
  is_paused = false,
  next_message_scheduled_at = NOW(), -- Reschedule for now
  metadata = metadata - 'pause_reason' - 'paused_at', -- Remove pause metadata
  updated_at = NOW()
WHERE flow_id = '33333333-3333-3333-3333-333333333333'
AND is_paused = true;

-- ===========================================
-- PART 5: Check cron job for SMS flows
-- ===========================================

SELECT jobname, schedule, command 
FROM cron.job 
WHERE jobname LIKE '%sms%' OR command LIKE '%sms%';

-- ===========================================
-- PART 6: Verify flow is active
-- ===========================================

UPDATE sms_flows
SET is_active = true
WHERE id = '33333333-3333-3333-3333-333333333333';

-- ===========================================
-- PART 7: Summary after fix
-- ===========================================

SELECT 
  'Bi-Weekly Engagement' as flow,
  COUNT(*) FILTER (WHERE is_paused = false) as active_count,
  COUNT(*) FILTER (WHERE is_paused = true) as still_paused,
  COUNT(*) FILTER (WHERE next_message_scheduled_at <= NOW()) as ready_to_send
FROM user_sms_flow_status
WHERE flow_id = '33333333-3333-3333-3333-333333333333';

-- Fix Email & SMS Flow Enrollment Issues
-- Run this in Supabase SQL editor
-- NO BACKFILLING - just ensures flows are active for future subscriptions

-- ===========================================
-- PART 1: Check email flows status
-- ===========================================

SELECT 
  'EMAIL FLOW' as type,
  id, 
  name, 
  display_name, 
  is_active,
  trigger_type
FROM email_flows
ORDER BY name;

-- ===========================================
-- PART 2: Check SMS flows status  
-- ===========================================

SELECT 
  'SMS FLOW' as type,
  id,
  name,
  description,
  is_active,
  trigger_type
FROM sms_flows
ORDER BY name;

-- ===========================================
-- PART 3: Ensure flows are active
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
-- PART 4: Verify cron jobs are running
-- ===========================================

-- Check if email flow cron job exists
SELECT jobname, schedule, command FROM cron.job WHERE jobname LIKE '%email%';

-- Check if SMS flow cron job exists  
SELECT jobname, schedule, command FROM cron.job WHERE jobname LIKE '%sms%';

-- ===========================================
-- PART 5: Summary - current enrollment counts
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

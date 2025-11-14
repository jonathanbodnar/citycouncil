-- Diagnostic script for SMS campaign failure
-- Run this to identify the issue

-- 1. Check if beta_signups table exists and has data
SELECT 
  'beta_signups table check' as check_type,
  EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'beta_signups'
  ) as table_exists,
  (SELECT COUNT(*) FROM beta_signups) as signup_count;

-- 2. Check if the test campaign was created
SELECT 
  'Campaign creation check' as check_type,
  id,
  campaign_name,
  message,
  target_audience,
  recipient_count,
  sent_count,
  failed_count,
  status,
  created_at
FROM sms_campaigns
ORDER BY created_at DESC
LIMIT 1;

-- 3. Check SMS logs for failures
SELECT 
  'SMS logs check' as check_type,
  sl.campaign_id,
  sl.phone_number,
  sl.status,
  sl.error_message,
  sl.sent_at
FROM sms_logs sl
WHERE sl.campaign_id = (
  SELECT id FROM sms_campaigns ORDER BY created_at DESC LIMIT 1
)
ORDER BY sl.sent_at DESC
LIMIT 10;

-- 4. Check if get_users_by_segment function works
SELECT 
  'Beta segment test' as check_type,
  COUNT(*) as recipient_count
FROM get_users_by_segment('beta');

-- 5. Show actual beta recipients
SELECT 
  'Beta recipients' as check_type,
  id,
  phone_number,
  full_name,
  email,
  user_tags
FROM get_users_by_segment('beta')
LIMIT 5;

-- 6. Check Edge Function secrets (they should exist)
SELECT 
  'Required env vars' as check_type,
  'TWILIO_ACCOUNT_SID' as var_name,
  'Should be set in Supabase Edge Function secrets' as status
UNION ALL
SELECT 
  'Required env vars',
  'TWILIO_AUTH_TOKEN',
  'Should be set in Supabase Edge Function secrets'
UNION ALL
SELECT 
  'Required env vars',
  'USER_SMS_PHONE_NUMBER',
  'Should be +16592185163';


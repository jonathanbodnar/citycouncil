-- Check why jonathanbagwell23@gmail.com didn't receive talent connection email

-- 1. Check if user exists and which talent they subscribed to
SELECT 
  id,
  email, 
  phone,
  full_name,
  promo_source,
  created_at
FROM users 
WHERE email = 'jonathanbagwell23@gmail.com';

-- 2. Check email flow enrollment status
SELECT 
  id,
  email,
  flow_id,
  current_message_order,
  next_email_scheduled_at,
  last_email_sent_at,
  flow_started_at,
  flow_completed_at,
  source_talent_slug,
  is_paused,
  unsubscribed,
  metadata,
  created_at
FROM user_email_flow_status
WHERE email = 'jonathanbagwell23@gmail.com';

-- 3. Check email send log
SELECT 
  id,
  email,
  flow_id,
  subject,
  status,
  error_message,
  sent_at,
  opened_at,
  clicked_at
FROM email_send_log
WHERE email = 'jonathanbagwell23@gmail.com'
ORDER BY sent_at DESC;

-- 4. Check if talent connection flow exists and is active
SELECT 
  id,
  name,
  display_name,
  is_active,
  trigger_type
FROM email_flows
WHERE id = 'aaaa1111-1111-1111-1111-111111111111';

-- 5. Check talent connection flow messages
SELECT 
  sequence_order,
  subject,
  delay_minutes,
  delay_hours,
  delay_days,
  is_active
FROM email_flow_messages
WHERE flow_id = 'aaaa1111-1111-1111-1111-111111111111'
ORDER BY sequence_order;

-- 6. Check if there are any global unsubscribes
SELECT * FROM email_unsubscribes
WHERE email = 'jonathanbagwell23@gmail.com';

-- RECOMMENDATIONS:
-- If user_email_flow_status exists but no email sent:
--   - Check if next_email_scheduled_at is in the future
--   - Check if is_paused = true
--   - Check if flow is active
--   - Make sure the email cron job is running
-- If user_email_flow_status doesn't exist:
--   - User wasn't enrolled properly during subscription
--   - May need to manually enroll them


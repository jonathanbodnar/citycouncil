-- Enable SMS notifications for all notification types

-- First, check what notification types exist
SELECT 
  notification_type,
  sms_enabled,
  sms_template
FROM notification_settings
ORDER BY notification_type;

-- Enable SMS for talent notifications
UPDATE notification_settings
SET 
  sms_enabled = true,
  sms_template = CASE notification_type
    WHEN 'talent_new_order' THEN 
      'New ShoutOut order from {{user_name}}! Amount: ${{amount}}. Check your dashboard to fulfill it: https://shoutout.us/orders'
    WHEN 'talent_order_deadline' THEN 
      'Reminder: Your ShoutOut order is due in {{hours}} hours! Complete it at: https://shoutout.us/orders'
    ELSE sms_template
  END
WHERE notification_type IN ('talent_new_order', 'talent_order_deadline');

-- Enable SMS for user notifications
UPDATE notification_settings
SET 
  sms_enabled = true,
  sms_template = CASE notification_type
    WHEN 'user_order_approved' THEN 
      '🎉 Great news! {{talent_name}} approved your ShoutOut order and will start working on it soon!'
    WHEN 'user_order_completed' THEN 
      '🎬 Your ShoutOut from {{talent_name}} is ready! Watch it now: https://shoutout.us/orders'
    ELSE sms_template
  END
WHERE notification_type IN ('user_order_approved', 'user_order_completed');

-- Insert missing notification types if they don't exist
INSERT INTO notification_settings (
  notification_type, 
  display_name,
  description,
  sms_enabled, 
  email_enabled,
  in_app_enabled,
  sms_template, 
  created_at, 
  updated_at
)
VALUES 
  (
    'talent_new_order', 
    'New Order (Talent)',
    'Notify talent when they receive a new order',
    true,
    true,
    true,
    'New ShoutOut order from {{user_name}}! Amount: ${{amount}}. Check your dashboard: https://shoutout.us/orders',
    NOW(), 
    NOW()
  ),
  (
    'talent_order_deadline', 
    'Order Deadline (Talent)',
    'Remind talent when order deadline is approaching',
    true,
    true,
    true,
    'Reminder: Your ShoutOut order is due in {{hours}} hours! Complete it at: https://shoutout.us/orders',
    NOW(), 
    NOW()
  ),
  (
    'user_order_approved', 
    'Order Approved (User)',
    'Notify user when talent approves their order',
    true,
    true,
    true,
    '🎉 {{talent_name}} approved your ShoutOut order and will start working on it soon!',
    NOW(), 
    NOW()
  ),
  (
    'user_order_completed', 
    'Order Completed (User)',
    'Notify user when their video is ready',
    true,
    true,
    true,
    '🎬 Your ShoutOut from {{talent_name}} is ready! Watch it now: https://shoutout.us/orders',
    NOW(), 
    NOW()
  )
ON CONFLICT (notification_type) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  sms_enabled = EXCLUDED.sms_enabled,
  email_enabled = EXCLUDED.email_enabled,
  in_app_enabled = EXCLUDED.in_app_enabled,
  sms_template = EXCLUDED.sms_template,
  updated_at = NOW();

-- Verify settings
SELECT 
  notification_type,
  sms_enabled,
  sms_template,
  '✅ SMS Enabled' as status
FROM notification_settings
WHERE sms_enabled = true
ORDER BY notification_type;

SELECT 
  CASE 
    WHEN COUNT(*) FILTER (WHERE sms_enabled = true) > 0 THEN 
      '✅ SMS notifications are now enabled for ' || COUNT(*) FILTER (WHERE sms_enabled = true) || ' notification type(s)'
    ELSE 
      '⚠️ No SMS notifications enabled'
  END as result
FROM notification_settings;


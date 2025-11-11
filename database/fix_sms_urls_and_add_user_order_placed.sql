-- Fix SMS notification URLs and add user_order_placed notification type
-- This ensures all SMS use unique fulfillment URLs instead of /orders

-- Step 1: Add user_order_placed notification type
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
VALUES (
  'user_order_placed',
  'Order Placed (User)',
  'Sent to users when they successfully place an order',
  true,
  false,
  true,
  '✅ Your ShoutOut order from {{talent_name}} is confirmed! We''ll notify you when it''s ready. Track it here: {{order_link}}',
  NOW(),
  NOW()
)
ON CONFLICT (notification_type) DO UPDATE SET
  sms_enabled = true,
  sms_template = '✅ Your ShoutOut order from {{talent_name}} is confirmed! We''ll notify you when it''s ready. Track it here: {{order_link}}',
  updated_at = NOW();

-- Step 2: Update talent_new_order to use fulfillment link
UPDATE notification_settings
SET 
  sms_template = '🎬 New ShoutOut order from {{user_name}}! Amount: ${{amount}}. Fulfill it now: {{order_link}}',
  updated_at = NOW()
WHERE notification_type = 'talent_new_order';

-- Step 3: Update user_order_approved to include order link
UPDATE notification_settings
SET 
  sms_template = '👍 Great news! {{talent_name}} approved your ShoutOut order and will start working on it soon. Track it: {{order_link}}',
  updated_at = NOW()
WHERE notification_type = 'user_order_approved';

-- Step 4: Update user_order_completed to use order link
UPDATE notification_settings
SET 
  sms_template = '🎉 Your ShoutOut from {{talent_name}} is ready! Watch it now: {{order_link}}',
  updated_at = NOW()
WHERE notification_type = 'user_order_completed';

-- Step 5: Update talent_order_deadline to use order link
UPDATE notification_settings
SET 
  sms_template = '⏰ Reminder: Your ShoutOut order is due in {{hours}} hours! Complete it: {{order_link}}',
  updated_at = NOW()
WHERE notification_type = 'talent_order_deadline';

-- Verify the changes
SELECT 
  notification_type,
  display_name,
  sms_enabled,
  sms_template
FROM notification_settings
WHERE notification_type IN (
  'user_order_placed',
  'talent_new_order',
  'user_order_approved',
  'user_order_completed',
  'talent_order_deadline'
)
ORDER BY notification_type;


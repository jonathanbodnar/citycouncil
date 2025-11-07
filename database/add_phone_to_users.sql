-- Add phone number to users table for SMS notifications
-- Phone numbers will be stored in E.164 format (+1XXXXXXXXXX)

-- Add phone_number column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- Add index for phone lookups
CREATE INDEX IF NOT EXISTS idx_users_phone_number ON users(phone_number);

-- Add comment
COMMENT ON COLUMN users.phone_number IS 'User phone number in E.164 format for SMS notifications';

-- Add notification settings for users (order approved, order complete)
INSERT INTO notification_settings (notification_type, display_name, description, sms_enabled, email_enabled, in_app_enabled, sms_template)
VALUES 
  ('user_order_approved', 'Order Approved (User)', 'Notify user when talent approves their order', true, false, false, 'Great news! {{talent_name}} approved your ShoutOut order. They''ll start working on it soon. Track progress: {{order_link}}'),
  ('user_order_completed', 'Order Completed (User)', 'Notify user when their video is ready', true, false, false, 'Your ShoutOut from {{talent_name}} is ready! 🎉 Watch it now: {{order_link}}')
ON CONFLICT (notification_type) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  sms_template = EXCLUDED.sms_template;


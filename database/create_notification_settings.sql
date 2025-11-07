-- Create notification_settings table
CREATE TABLE IF NOT EXISTS notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  sms_enabled BOOLEAN DEFAULT false,
  email_enabled BOOLEAN DEFAULT false,
  in_app_enabled BOOLEAN DEFAULT true,
  sms_template TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default notification settings
INSERT INTO notification_settings (notification_type, display_name, description, sms_enabled, sms_template)
VALUES 
  ('talent_new_order', 'Talent: New Order', 'SMS sent to talent when they receive a new order', false, 'Hey {{first_name}}, you got a new ShoutOut order, fulfill here: {{order_link}}'),
  ('talent_deadline_approaching', 'Talent: Deadline Approaching', 'SMS sent to talent when order deadline is approaching', false, 'Hey {{first_name}}, your ShoutOut order is due in {{hours}} hours. Complete it here: {{order_link}}'),
  ('user_order_confirmed', 'User: Order Confirmed', 'SMS sent to user when their order is confirmed', false, 'Hey {{first_name}}, your ShoutOut from {{talent_name}} is confirmed! Track it here: {{order_link}}'),
  ('user_order_delivered', 'User: Order Delivered', 'SMS sent to user when their order is delivered', false, 'Hey {{first_name}}, your ShoutOut from {{talent_name}} is ready! Watch it here: {{order_link}}')
ON CONFLICT (notification_type) DO NOTHING;

-- Enable RLS
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

-- Admin can read/write
CREATE POLICY "Admins can manage notification settings"
  ON notification_settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.user_type = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.user_type = 'admin'
    )
  );

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_notification_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notification_settings_updated_at
  BEFORE UPDATE ON notification_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_settings_updated_at();


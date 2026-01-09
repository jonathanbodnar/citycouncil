-- Email Flow Management System
-- Similar to SMS flows but for email with more robust features

-- 1. Email Flows - defines the flow types
CREATE TABLE IF NOT EXISTS email_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  trigger_type TEXT NOT NULL, -- 'bio_page', 'giveaway', 'direct_signup', 'manual', 'order_complete', 'talent_signup'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Email Flow Messages - individual emails in a flow
CREATE TABLE IF NOT EXISTS email_flow_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id UUID NOT NULL REFERENCES email_flows(id) ON DELETE CASCADE,
  sequence_order INT NOT NULL, -- 1, 2, 3... order in the flow
  subject TEXT NOT NULL,
  preview_text TEXT, -- Email preview text
  html_content TEXT NOT NULL, -- Full HTML email content
  plain_text_content TEXT, -- Plain text fallback
  delay_minutes INT DEFAULT 0, -- minutes after previous email (or flow start for first)
  delay_hours INT DEFAULT 0,
  delay_days INT DEFAULT 0,
  send_at_time TIME, -- Optional: specific time of day to send (e.g., 09:00)
  send_on_days TEXT[], -- Optional: specific days ['monday', 'tuesday', etc.]
  include_coupon BOOLEAN DEFAULT false,
  coupon_code TEXT, -- Specific coupon for this email (overrides user's coupon)
  include_unsubscribe BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(flow_id, sequence_order)
);

-- 3. User Email Flow Status - tracks where each user is in each flow
CREATE TABLE IF NOT EXISTS user_email_flow_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL, -- denormalized for quick lookup
  flow_id UUID NOT NULL REFERENCES email_flows(id) ON DELETE CASCADE,
  current_message_order INT DEFAULT 0, -- 0 = not started, 1 = first email sent, etc.
  last_email_sent_at TIMESTAMPTZ,
  next_email_scheduled_at TIMESTAMPTZ,
  flow_started_at TIMESTAMPTZ DEFAULT NOW(),
  flow_completed_at TIMESTAMPTZ, -- null if still in progress
  source_url TEXT, -- Where user came from (for tracking)
  source_talent_slug TEXT, -- If from bio page, which talent
  coupon_code TEXT, -- user's specific coupon for this flow
  coupon_used BOOLEAN DEFAULT false,
  is_paused BOOLEAN DEFAULT false, -- admin can pause individual users
  unsubscribed BOOLEAN DEFAULT false, -- user unsubscribed from this flow
  metadata JSONB DEFAULT '{}', -- extra data
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(email, flow_id)
);

-- 4. Email Send Log - history of all emails sent
CREATE TABLE IF NOT EXISTS email_send_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  flow_id UUID REFERENCES email_flows(id) ON DELETE SET NULL,
  message_id UUID REFERENCES email_flow_messages(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  sendgrid_message_id TEXT, -- SendGrid's message ID for tracking
  status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed'
  error_message TEXT,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- 5. Email Templates - reusable email templates
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  subject TEXT NOT NULL,
  preview_text TEXT,
  html_content TEXT NOT NULL,
  plain_text_content TEXT,
  variables TEXT[], -- List of variables like ['first_name', 'coupon_code', 'talent_name']
  category TEXT DEFAULT 'general', -- 'welcome', 'promotional', 'transactional', 'engagement'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Email Unsubscribes - global unsubscribe list
CREATE TABLE IF NOT EXISTS email_unsubscribes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  reason TEXT,
  unsubscribed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_email_flow_status_next_scheduled 
  ON user_email_flow_status(next_email_scheduled_at) 
  WHERE flow_completed_at IS NULL AND is_paused = false AND unsubscribed = false;

CREATE INDEX IF NOT EXISTS idx_user_email_flow_status_email 
  ON user_email_flow_status(email);

CREATE INDEX IF NOT EXISTS idx_email_send_log_email 
  ON email_send_log(email);

CREATE INDEX IF NOT EXISTS idx_email_send_log_sent_at 
  ON email_send_log(sent_at);

CREATE INDEX IF NOT EXISTS idx_email_send_log_sendgrid_id
  ON email_send_log(sendgrid_message_id);

CREATE INDEX IF NOT EXISTS idx_email_unsubscribes_email
  ON email_unsubscribes(email);

-- Insert default flows
INSERT INTO email_flows (id, name, display_name, description, trigger_type) VALUES
  ('aaaa1111-1111-1111-1111-111111111111', 'bio_page_welcome', '🔗 Bio Page Welcome', 'Welcome series for users who sign up from a talent bio page', 'bio_page'),
  ('aaaa2222-2222-2222-2222-222222222222', 'giveaway_welcome', '🎁 Giveaway Welcome', 'Welcome series for giveaway participants', 'giveaway'),
  ('aaaa3333-3333-3333-3333-333333333333', 'direct_signup_welcome', '👋 Direct Signup Welcome', 'Welcome series for users who sign up directly', 'direct_signup'),
  ('aaaa4444-4444-4444-4444-444444444444', 'order_followup', '📦 Order Follow-up', 'Follow-up emails after order completion', 'order_complete'),
  ('aaaa5555-5555-5555-5555-555555555555', 'talent_onboarding', '⭐ Talent Onboarding', 'Onboarding emails for new talent', 'talent_signup')
ON CONFLICT (name) DO NOTHING;

-- Insert sample welcome email for giveaway flow
INSERT INTO email_flow_messages (flow_id, sequence_order, subject, preview_text, html_content, delay_hours, include_coupon) VALUES
  ('aaaa2222-2222-2222-2222-222222222222', 1, 
   '🎉 Welcome to ShoutOut - Your Prize Awaits!', 
   'Claim your personalized video from top conservatives',
   '<html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
<h1 style="color: #7c3aed;">Welcome to ShoutOut! 🎉</h1>
<p>Hey there!</p>
<p>Thanks for entering our giveaway! You''re now part of an exclusive community that connects with your favorite free-speech voices.</p>
<p>Don''t forget to use your prize - get a personalized video ShoutOut from top conservatives like:</p>
<ul>
<li>Shawn Farash</li>
<li>Jeremy Boreing</li>
<li>And many more...</li>
</ul>
<p><a href="https://shoutout.us?utm=email_welcome&coupon={{coupon_code}}" style="display: inline-block; background: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Browse Personalities →</a></p>
<p style="color: #666; font-size: 14px; margin-top: 30px;">Questions? Just reply to this email!</p>
</body></html>',
   24, true)
ON CONFLICT (flow_id, sequence_order) DO NOTHING;

-- Enable RLS
ALTER TABLE email_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_flow_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_email_flow_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_send_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_unsubscribes ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Admin only access
CREATE POLICY "Admin full access to email_flows" ON email_flows FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND user_type = 'admin'));

CREATE POLICY "Admin full access to email_flow_messages" ON email_flow_messages FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND user_type = 'admin'));

CREATE POLICY "Admin full access to user_email_flow_status" ON user_email_flow_status FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND user_type = 'admin'));

CREATE POLICY "Admin full access to email_send_log" ON email_send_log FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND user_type = 'admin'));

CREATE POLICY "Admin full access to email_templates" ON email_templates FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND user_type = 'admin'));

CREATE POLICY "Admin full access to email_unsubscribes" ON email_unsubscribes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND user_type = 'admin'));

-- Service role access
CREATE POLICY "Service role access to email_flows" ON email_flows FOR ALL TO service_role USING (true);
CREATE POLICY "Service role access to email_flow_messages" ON email_flow_messages FOR ALL TO service_role USING (true);
CREATE POLICY "Service role access to user_email_flow_status" ON user_email_flow_status FOR ALL TO service_role USING (true);
CREATE POLICY "Service role access to email_send_log" ON email_send_log FOR ALL TO service_role USING (true);
CREATE POLICY "Service role access to email_templates" ON email_templates FOR ALL TO service_role USING (true);
CREATE POLICY "Service role access to email_unsubscribes" ON email_unsubscribes FOR ALL TO service_role USING (true);

-- Grant permissions
GRANT ALL ON email_flows TO authenticated;
GRANT ALL ON email_flow_messages TO authenticated;
GRANT ALL ON user_email_flow_status TO authenticated;
GRANT ALL ON email_send_log TO authenticated;
GRANT ALL ON email_templates TO authenticated;
GRANT ALL ON email_unsubscribes TO authenticated;


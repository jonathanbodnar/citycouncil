-- SMS Flow Management System
-- This creates tables for managing automated SMS sequences

-- 1. SMS Flows - defines the flow types (giveaway, new_talent, etc.)
CREATE TABLE IF NOT EXISTS sms_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  trigger_type TEXT NOT NULL, -- 'giveaway_entry', 'new_talent', 'manual', 'scheduled'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. SMS Flow Messages - individual messages in a flow
CREATE TABLE IF NOT EXISTS sms_flow_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id UUID NOT NULL REFERENCES sms_flows(id) ON DELETE CASCADE,
  sequence_order INT NOT NULL, -- 1, 2, 3... order in the flow
  message_text TEXT NOT NULL,
  delay_hours INT DEFAULT 0, -- hours after previous message (or flow start for first message)
  delay_days INT DEFAULT 0, -- days after previous message
  include_coupon BOOLEAN DEFAULT false, -- whether to append user's coupon code
  include_link BOOLEAN DEFAULT true, -- whether message includes a link
  link_utm TEXT, -- utm parameter for tracking
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(flow_id, sequence_order)
);

-- 3. User Flow Status - tracks where each user is in each flow
CREATE TABLE IF NOT EXISTS user_sms_flow_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  phone TEXT NOT NULL, -- denormalized for quick lookup
  flow_id UUID NOT NULL REFERENCES sms_flows(id) ON DELETE CASCADE,
  current_message_order INT DEFAULT 0, -- 0 = not started, 1 = first message sent, etc.
  last_message_sent_at TIMESTAMPTZ,
  next_message_scheduled_at TIMESTAMPTZ,
  flow_started_at TIMESTAMPTZ DEFAULT NOW(),
  flow_completed_at TIMESTAMPTZ, -- null if still in progress
  coupon_code TEXT, -- user's specific coupon for this flow
  coupon_used BOOLEAN DEFAULT false,
  is_paused BOOLEAN DEFAULT false, -- admin can pause individual users
  metadata JSONB DEFAULT '{}', -- extra data like talent_id for announcements
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(phone, flow_id)
);

-- 4. SMS Send Log - history of all SMS sent
CREATE TABLE IF NOT EXISTS sms_send_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  flow_id UUID REFERENCES sms_flows(id) ON DELETE SET NULL,
  message_id UUID REFERENCES sms_flow_messages(id) ON DELETE SET NULL,
  message_text TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'failed', 'delivered'
  error_message TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- 5. Add promote field to talent_profiles if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'talent_profiles' AND column_name = 'promote_on_launch'
  ) THEN
    ALTER TABLE talent_profiles ADD COLUMN promote_on_launch BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_sms_flow_status_next_scheduled 
  ON user_sms_flow_status(next_message_scheduled_at) 
  WHERE flow_completed_at IS NULL AND is_paused = false;

CREATE INDEX IF NOT EXISTS idx_user_sms_flow_status_phone 
  ON user_sms_flow_status(phone);

CREATE INDEX IF NOT EXISTS idx_sms_send_log_phone 
  ON sms_send_log(phone);

CREATE INDEX IF NOT EXISTS idx_sms_send_log_sent_at 
  ON sms_send_log(sent_at);

-- Insert default flows
INSERT INTO sms_flows (id, name, description, trigger_type) VALUES
  ('11111111-1111-1111-1111-111111111111', 'giveaway_welcome', 'Initial welcome message after giveaway entry', 'giveaway_entry'),
  ('22222222-2222-2222-2222-222222222222', 'giveaway_followup', '72-hour follow-up for unused codes', 'scheduled'),
  ('33333333-3333-3333-3333-333333333333', 'giveaway_ongoing', 'Bi-weekly engagement messages for giveaway users', 'scheduled'),
  ('44444444-4444-4444-4444-444444444444', 'new_talent_announcement', 'Announcement when promoted talent goes live', 'new_talent')
ON CONFLICT (name) DO NOTHING;

-- Insert default messages for giveaway_welcome flow
INSERT INTO sms_flow_messages (flow_id, sequence_order, message_text, delay_hours, include_coupon, include_link, link_utm) VALUES
  ('11111111-1111-1111-1111-111111111111', 1, 'ShoutOut is a new way to support & connect with your favorite free-speech voices! We''re always adding new celebrities 🎉 we''ll keep you updated with fresh news.', 0, false, false, null)
ON CONFLICT (flow_id, sequence_order) DO NOTHING;

-- Insert default messages for giveaway_followup flow (72 hours)
INSERT INTO sms_flow_messages (flow_id, sequence_order, message_text, delay_hours, delay_days, include_coupon, include_link, link_utm) VALUES
  ('22222222-2222-2222-2222-222222222222', 1, 'We can all be Joe Biden and forget...so we extended your ShoutOut discount! Pick the perfect free-speech celebrity to get your personalized video ShoutOut 🍻', 0, 3, true, true, 'followup')
ON CONFLICT (flow_id, sequence_order) DO NOTHING;

-- Insert default messages for giveaway_ongoing flow (bi-weekly)
INSERT INTO sms_flow_messages (flow_id, sequence_order, message_text, delay_days, include_coupon, include_link, link_utm) VALUES
  ('33333333-3333-3333-3333-333333333333', 1, 'Mainstream media won''t say your name… but your favorite free-speech voice will 😏
Get a personalized video 👉 https://shoutout.us?utm=thread', 14, false, true, 'thread'),
  ('33333333-3333-3333-3333-333333333333', 2, 'Because Hallmark cards don''t clap back 📣
Get a personalized shoutout 👉 https://shoutout.us?utm=thread', 14, false, true, 'thread'),
  ('33333333-3333-3333-3333-333333333333', 3, 'Joe Biden may forget your name… but your favorite free-speech voice won''t 😏
Get a personalized shoutout 👉 https://shoutout.us?utm=thread', 14, false, true, 'thread'),
  ('33333333-3333-3333-3333-333333333333', 4, 'Your DM was ignored. Your personalized video shoutout won''t be 😏
Say it with a ShoutOut 👉 https://shoutout.us?utm=thread', 14, false, true, 'thread'),
  ('33333333-3333-3333-3333-333333333333', 5, 'This is either the best gift ever or a terrible idea. No in-between 😬
Say it with a ShoutOut 👉 https://shoutout.us?utm=thread', 14, false, true, 'thread'),
  ('33333333-3333-3333-3333-333333333333', 6, 'Set fire to your group chat 🔥 Get a personalized video ShoutOut from famous people 👉 https://shoutout.us?utm=thread', 14, false, true, 'thread'),
  ('33333333-3333-3333-3333-333333333333', 7, 'Better than flowers. Worse than therapy 😅
Say it with a ShoutOut 👉 https://shoutout.us?utm=thread', 14, false, true, 'thread'),
  ('33333333-3333-3333-3333-333333333333', 8, 'You''ve typed 10,000 comments. Time to let someone famous say YOUR name 😤
Say it with a ShoutOut 👉 https://shoutout.us?utm=thread', 14, false, true, 'thread'),
  ('33333333-3333-3333-3333-333333333333', 9, 'Arguing in comments is free. Winning with a personalized video shoutout from a celebrity is better 😎
https://shoutout.us?utm=thread', 14, false, true, 'thread'),
  ('33333333-3333-3333-3333-333333333333', 10, 'You''ve won debates in comments. Now win the group chat 📲
Say it with a ShoutOut 👉 https://shoutout.us?utm=thread', 14, false, true, 'thread'),
  ('33333333-3333-3333-3333-333333333333', 11, 'This is the flex you pretend you didn''t mean to post 😏
Say it with a ShoutOut 👉 https://shoutout.us?utm=thread', 14, false, true, 'thread'),
  ('33333333-3333-3333-3333-333333333333', 12, 'This will be brought up at every hangout from now on 🤣
Say it with a ShoutOut 👉 https://shoutout.us?utm=thread', 14, false, true, 'thread'),
  ('33333333-3333-3333-3333-333333333333', 13, 'They''ll ask how you pulled this off 😏
Say it with a ShoutOut 👉 https://shoutout.us?utm=thread', 14, false, true, 'thread'),
  ('33333333-3333-3333-3333-333333333333', 14, 'Take a personalized video shoutout to the next game night 🎮
Say it with a ShoutOut 👉 https://shoutout.us?utm=thread', 14, false, true, 'thread'),
  ('33333333-3333-3333-3333-333333333333', 15, 'Not a big deal… just a personalized video shoutout from someone famous 😏
Say it with a ShoutOut 👉 https://shoutout.us?utm=thread', 14, false, true, 'thread'),
  ('33333333-3333-3333-3333-333333333333', 16, 'This works on friends, family, and coworkers 😅
Say it with a ShoutOut 👉 https://shoutout.us?utm=thread', 14, false, true, 'thread')
ON CONFLICT (flow_id, sequence_order) DO NOTHING;

-- Insert default messages for new_talent_announcement flow
INSERT INTO sms_flow_messages (flow_id, sequence_order, message_text, delay_hours, include_coupon, include_link, link_utm) VALUES
  ('44444444-4444-4444-4444-444444444444', 1, 'We''re excited to announce that {talent_name} is now on ShoutOut! 🎉 Get 25% off a personalized video ShoutOut from them today only.', 0, true, true, 'announcement')
ON CONFLICT (flow_id, sequence_order) DO NOTHING;

-- Enable RLS
ALTER TABLE sms_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_flow_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sms_flow_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_send_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Admin only access
CREATE POLICY "Admin full access to sms_flows" ON sms_flows FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND user_type = 'admin'));

CREATE POLICY "Admin full access to sms_flow_messages" ON sms_flow_messages FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND user_type = 'admin'));

CREATE POLICY "Admin full access to user_sms_flow_status" ON user_sms_flow_status FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND user_type = 'admin'));

CREATE POLICY "Admin full access to sms_send_log" ON sms_send_log FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND user_type = 'admin'));

-- Service role access
CREATE POLICY "Service role access to sms_flows" ON sms_flows FOR ALL TO service_role USING (true);
CREATE POLICY "Service role access to sms_flow_messages" ON sms_flow_messages FOR ALL TO service_role USING (true);
CREATE POLICY "Service role access to user_sms_flow_status" ON user_sms_flow_status FOR ALL TO service_role USING (true);
CREATE POLICY "Service role access to sms_send_log" ON sms_send_log FOR ALL TO service_role USING (true);

-- Grant permissions
GRANT ALL ON sms_flows TO authenticated;
GRANT ALL ON sms_flow_messages TO authenticated;
GRANT ALL ON user_sms_flow_status TO authenticated;
GRANT ALL ON sms_send_log TO authenticated;


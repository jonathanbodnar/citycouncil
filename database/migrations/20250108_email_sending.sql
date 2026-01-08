-- Email sending infrastructure for talent updates

-- Add sent tracking to email_drafts
ALTER TABLE email_drafts 
ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS recipients_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS delivered_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS opened_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS clicked_count INTEGER DEFAULT 0;

-- Add unsubscribe tracking to talent_followers
ALTER TABLE talent_followers
ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS unsubscribe_token UUID DEFAULT gen_random_uuid();

-- Create index for unsubscribe lookups
CREATE INDEX IF NOT EXISTS idx_talent_followers_unsubscribe_token 
ON talent_followers(unsubscribe_token);

-- Track individual email sends for deliverability and compliance
CREATE TABLE IF NOT EXISTS email_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id UUID REFERENCES email_drafts(id) ON DELETE SET NULL,
  talent_id UUID NOT NULL REFERENCES talent_profiles(id) ON DELETE CASCADE,
  recipient_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  sendgrid_message_id TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed', 'unsubscribed')),
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  bounced_at TIMESTAMP WITH TIME ZONE,
  bounce_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for email_sends
CREATE INDEX IF NOT EXISTS idx_email_sends_talent_id ON email_sends(talent_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_draft_id ON email_sends(draft_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_sendgrid_message_id ON email_sends(sendgrid_message_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_status ON email_sends(status);

-- RLS for email_sends
ALTER TABLE email_sends ENABLE ROW LEVEL SECURITY;

-- Talents can view their own email sends
CREATE POLICY "Talents can view own email sends" ON email_sends
FOR SELECT TO authenticated
USING (talent_id IN (SELECT id FROM talent_profiles WHERE user_id = auth.uid()));

-- Admins can view all
CREATE POLICY "Admins can view all email sends" ON email_sends
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.user_type = 'admin'));

-- Service role can insert/update (for edge functions)
-- Note: Edge functions use service_role key which bypasses RLS


-- Create SMS messages table for admin-talent communications
CREATE TABLE IF NOT EXISTS sms_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_id UUID NOT NULL REFERENCES talent_profiles(id) ON DELETE CASCADE,
  from_admin BOOLEAN NOT NULL DEFAULT true,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'failed')),
  twilio_sid TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_sms_messages_talent_id ON sms_messages(talent_id);
CREATE INDEX IF NOT EXISTS idx_sms_messages_sent_at ON sms_messages(sent_at DESC);

-- Enable RLS
ALTER TABLE sms_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can see all messages
CREATE POLICY "Admins can view all SMS messages" ON sms_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.user_type = 'admin'
    )
  );

-- Policy: Admins can insert messages
CREATE POLICY "Admins can send SMS messages" ON sms_messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.user_type = 'admin'
    )
  );

-- Policy: Admins can update message status
CREATE POLICY "Admins can update SMS message status" ON sms_messages
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.user_type = 'admin'
    )
  );

COMMENT ON TABLE sms_messages IS 'SMS communications between admins and talent';
COMMENT ON COLUMN sms_messages.talent_id IS 'Talent receiving/sending the message';
COMMENT ON COLUMN sms_messages.from_admin IS 'True if message sent by admin, false if from talent';
COMMENT ON COLUMN sms_messages.message IS 'SMS message content (max 160 chars)';
COMMENT ON COLUMN sms_messages.status IS 'Message delivery status';
COMMENT ON COLUMN sms_messages.twilio_sid IS 'Twilio message SID for tracking';


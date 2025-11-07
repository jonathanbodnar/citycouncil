-- Add read tracking to sms_messages
ALTER TABLE sms_messages 
ADD COLUMN IF NOT EXISTS read_by_admin BOOLEAN DEFAULT FALSE;

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_sms_messages_unread 
ON sms_messages(talent_id, from_admin, read_by_admin) 
WHERE from_admin = FALSE AND read_by_admin = FALSE;


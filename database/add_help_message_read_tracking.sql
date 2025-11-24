-- Add read tracking to help_messages table

-- Add is_read column (defaults to false for new messages)
ALTER TABLE help_messages
ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;

-- Add index for faster unread queries
CREATE INDEX IF NOT EXISTS idx_help_messages_is_read ON help_messages(is_read);

-- Mark all existing messages as read (so admin doesn't get flooded with old messages)
UPDATE help_messages
SET is_read = true
WHERE is_read IS NULL OR is_read = false;

-- Verify the changes
SELECT 
    COUNT(*) as total_messages,
    COUNT(*) FILTER (WHERE is_read = false) as unread_messages,
    COUNT(*) FILTER (WHERE is_read = true) as read_messages
FROM help_messages;

SELECT '✅ Read tracking added to help_messages table. All existing messages marked as read.' AS status;


-- Create SMS Messages Table for Comms Center
-- This table stores SMS message history between admin and talent

-- =============================================================================
-- STEP 1: Create sms_messages table
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.sms_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  talent_id UUID NOT NULL REFERENCES talent_profiles(id) ON DELETE CASCADE,
  from_admin BOOLEAN NOT NULL DEFAULT true,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'failed')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- STEP 2: Create indexes for performance
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_sms_messages_talent_id 
  ON sms_messages(talent_id);

CREATE INDEX IF NOT EXISTS idx_sms_messages_sent_at 
  ON sms_messages(sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_sms_messages_status 
  ON sms_messages(status);

-- =============================================================================
-- STEP 3: Enable Row Level Security (RLS)
-- =============================================================================

ALTER TABLE sms_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Admin can view all messages" ON sms_messages;
DROP POLICY IF EXISTS "Admin can insert messages" ON sms_messages;
DROP POLICY IF EXISTS "Admin can update messages" ON sms_messages;
DROP POLICY IF EXISTS "Talent can view own messages" ON sms_messages;

-- Admin can do everything
CREATE POLICY "Admin can view all messages" ON sms_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.user_type = 'admin'
    )
  );

CREATE POLICY "Admin can insert messages" ON sms_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.user_type = 'admin'
    )
  );

CREATE POLICY "Admin can update messages" ON sms_messages
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.user_type = 'admin'
    )
  );

-- Talent can view their own messages
CREATE POLICY "Talent can view own messages" ON sms_messages
  FOR SELECT
  TO authenticated
  USING (
    talent_id IN (
      SELECT id FROM talent_profiles 
      WHERE user_id = auth.uid()
    )
  );

-- =============================================================================
-- STEP 4: Create updated_at trigger
-- =============================================================================

-- Create trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to sms_messages
DROP TRIGGER IF EXISTS update_sms_messages_updated_at ON sms_messages;
CREATE TRIGGER update_sms_messages_updated_at
  BEFORE UPDATE ON sms_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- STEP 5: Verify table creation
-- =============================================================================

SELECT 
  '✅ SMS Messages Table Created' as status,
  COUNT(*) as message_count,
  CASE 
    WHEN COUNT(*) = 0 THEN 'Empty table - ready for messages'
    ELSE 'Contains ' || COUNT(*) || ' messages'
  END as description
FROM sms_messages;

-- Show table structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'sms_messages'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Show indexes
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'sms_messages'
  AND schemaname = 'public'
ORDER BY indexname;

-- Show RLS policies
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'sms_messages'
  AND schemaname = 'public'
ORDER BY policyname;

-- =============================================================================
-- SUMMARY
-- =============================================================================

SELECT '
🎯 SMS MESSAGES TABLE CREATED

This table stores:
- ✅ SMS message history between admin and talent
- ✅ Message status tracking (sent, delivered, failed)
- ✅ Timestamps for sent_at and delivered_at
- ✅ Error messages if sending fails

Features:
- ✅ Row Level Security enabled
- ✅ Admin can send/view all messages
- ✅ Talent can view their own messages
- ✅ Indexes for fast queries
- ✅ Auto-updating updated_at column

Next steps:
1. Create send-sms Edge Function (if not exists)
2. Test sending SMS from Comms Center
3. Refresh Comms Center page

Note: This table is now ready for use by CommsCenterManagement.tsx

' as summary;

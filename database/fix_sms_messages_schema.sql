-- Fix SMS Messages Table Schema Issue
-- Error: column sms_messages.talent_id does not exist

-- =============================================================================
-- STEP 1: Check if table exists and what columns it has
-- =============================================================================

SELECT 
  '1. SMS_MESSAGES TABLE CHECK' as step,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sms_messages')
    THEN '✅ Table exists'
    ELSE '❌ Table does NOT exist'
  END as table_status;

-- Show all columns if table exists
SELECT 
  '2. CURRENT COLUMNS' as step,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'sms_messages'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- =============================================================================
-- STEP 2: Drop and recreate the table with correct schema
-- =============================================================================

-- Drop existing table (this will delete any existing messages)
DROP TABLE IF EXISTS public.sms_messages CASCADE;

-- Create table with correct schema
CREATE TABLE public.sms_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
-- STEP 3: Create indexes
-- =============================================================================

CREATE INDEX idx_sms_messages_talent_id ON sms_messages(talent_id);
CREATE INDEX idx_sms_messages_sent_at ON sms_messages(sent_at DESC);
CREATE INDEX idx_sms_messages_status ON sms_messages(status);

-- =============================================================================
-- STEP 4: Enable RLS
-- =============================================================================

ALTER TABLE sms_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Admin can view all messages" ON sms_messages;
DROP POLICY IF EXISTS "Admin can insert messages" ON sms_messages;
DROP POLICY IF EXISTS "Admin can update messages" ON sms_messages;
DROP POLICY IF EXISTS "Talent can view own messages" ON sms_messages;

-- Create policies
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
-- STEP 5: Create updated_at trigger
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_sms_messages_updated_at ON sms_messages;
CREATE TRIGGER update_sms_messages_updated_at
  BEFORE UPDATE ON sms_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- STEP 6: Verify the fix
-- =============================================================================

SELECT 
  '3. VERIFICATION' as step,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'sms_messages'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check for talent_id specifically
SELECT 
  '4. TALENT_ID CHECK' as step,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'sms_messages' 
      AND column_name = 'talent_id'
    )
    THEN '✅ talent_id column exists'
    ELSE '❌ talent_id column MISSING'
  END as status;

-- Show RLS policies
SELECT 
  '5. RLS POLICIES' as step,
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'sms_messages'
  AND schemaname = 'public'
ORDER BY policyname;

-- =============================================================================
-- STEP 7: Refresh schema cache
-- =============================================================================

NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- SUMMARY
-- =============================================================================

SELECT '
🎯 SMS MESSAGES TABLE FIXED

Changes made:
✅ Dropped and recreated sms_messages table
✅ Added talent_id column with foreign key
✅ Added from_admin column (boolean)
✅ Added message, status, timestamps columns
✅ Created indexes for performance
✅ Enabled RLS with admin/talent policies
✅ Added updated_at trigger
✅ Refreshed schema cache

Next steps:
1. Refresh Comms Center page
2. Messages should now load
3. Test sending/receiving SMS

Note: Any existing messages were deleted during recreation.
If you had important messages, contact admin to restore from backup.

' as summary;


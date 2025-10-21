-- Fix real-time chat functionality
-- Allow proper RLS policies for help_messages table

-- Enable RLS on help_messages if not already enabled
ALTER TABLE help_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow users to insert help messages" ON help_messages;
DROP POLICY IF EXISTS "Allow users to view own help messages" ON help_messages;
DROP POLICY IF EXISTS "Allow admin to update help messages" ON help_messages;
DROP POLICY IF EXISTS "Allow admin to manage all help messages" ON help_messages;

-- Allow authenticated users to insert their own help messages
CREATE POLICY "Allow users to insert help messages" ON help_messages
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow users to view their own help messages (for real-time updates)
CREATE POLICY "Allow users to view own help messages" ON help_messages
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

-- Allow admins to view and update all help messages
CREATE POLICY "Allow admin to manage all help messages" ON help_messages
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.user_type = 'admin'
  )
);

-- Allow admin to update help messages with responses
CREATE POLICY "Allow admin to update help messages" ON help_messages
FOR UPDATE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.user_type = 'admin'
  )
);

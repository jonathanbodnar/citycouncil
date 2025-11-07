-- Fix notifications RLS policy for order fulfillment notifications
-- Issue: Talent can't create notifications when uploading videos

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON notifications;
DROP POLICY IF EXISTS "Service role can insert notifications" ON notifications;

-- Create a more permissive INSERT policy
-- Allow any authenticated user to create notifications for any user
CREATE POLICY "Anyone can create notifications"
  ON notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Also allow service role (for edge functions)
CREATE POLICY "Service role can insert notifications"
  ON notifications
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Verify the policies
SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'notifications';


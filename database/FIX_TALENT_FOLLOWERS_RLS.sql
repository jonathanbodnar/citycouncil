-- Fix RLS for talent_followers to allow admins to view all records
-- This is needed for the Admin > Users panel to show subscription tags

-- Add policy for admins to read all talent_followers
CREATE POLICY "Admins can view all followers" ON talent_followers
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.user_type = 'admin'
  )
);


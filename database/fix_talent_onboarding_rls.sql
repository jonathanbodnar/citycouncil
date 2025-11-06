-- Fix RLS policy to allow user_type conversion during onboarding
-- This fixes the catch-22 where you need to be talent to update to talent

-- Drop the old policy that blocks the update
DROP POLICY IF EXISTS "Allow talent self-update" ON users;

-- Create new policy that allows updates during onboarding
-- Users can update their own record to become talent OR update if already talent
CREATE POLICY "Allow user self-update and talent conversion" ON users
FOR UPDATE 
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id AND 
  (user_type = 'talent' OR user_type = 'user')  -- Allow conversion from user to talent
);

COMMENT ON POLICY "Allow user self-update and talent conversion" ON users IS 
'Allows authenticated users to update their own user record, including converting from user to talent during onboarding';


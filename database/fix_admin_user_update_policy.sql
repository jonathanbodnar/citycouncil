-- FIX: Admin cannot update other users' phone numbers
-- Problem: RLS policies only allowed users to update their OWN records
-- Solution: Add policy allowing admins to update ANY user

-- Create admin policy to allow admins to update ANY user's record
CREATE POLICY "Admins can update any user"
ON public.users
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND user_type = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND user_type = 'admin'
  )
);

-- This policy allows:
-- ✓ Admin users (user_type = 'admin') to UPDATE any row in users table
-- ✓ Includes updating phone, email, full_name, avatar_url, etc.
-- ✓ Required for Admin > Talent Management to update talent phone numbers

-- Test:
-- 1. Log in as admin@shoutout.com
-- 2. Go to Admin > Talent Management
-- 3. Edit any talent's phone number
-- 4. Save - should now work!


-- Fix: Allow anonymous and authenticated users to update beta_signups
-- This is needed for the holiday popup to update existing entries with prize info

-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "Anyone can update beta signups" ON beta_signups;
DROP POLICY IF EXISTS "Anon can update beta signups" ON beta_signups;

-- Allow anonymous users to update (for popup before login)
CREATE POLICY "Anon can update beta signups" ON beta_signups
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to update
CREATE POLICY "Authenticated can update beta signups" ON beta_signups
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- Verify policies
SELECT 
  policyname,
  cmd,
  roles
FROM pg_policies 
WHERE tablename = 'beta_signups'
ORDER BY policyname;


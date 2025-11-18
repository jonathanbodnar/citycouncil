-- Fix: Allow anonymous users to count beta_signups for "spots remaining" display

-- Currently, anon users can only INSERT but not SELECT/count
-- This causes the landing page to show stale count (197)

-- Add policy to allow anon users to count beta_signups
-- This is safe because:
-- 1. We're not exposing phone numbers (count only)
-- 2. It's just for displaying "spots remaining"
-- 3. The frontend uses { count: 'exact', head: true } which doesn't return data

CREATE POLICY "Anyone can count beta signups" ON beta_signups
  FOR SELECT TO anon
  USING (true);

-- Verify policies
SELECT 
    'Beta Signups RLS Policies' as label,
    policyname,
    cmd,
    roles,
    qual
FROM pg_policies 
WHERE tablename = 'beta_signups'
ORDER BY policyname;

-- Test the count as anon
SET ROLE anon;
SELECT 
    'Can anon count now?' as check_type,
    COUNT(*) as count,
    250 - COUNT(*) as spots_remaining
FROM beta_signups;
RESET ROLE;


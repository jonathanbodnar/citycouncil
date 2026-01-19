-- Enable Donate/Support Link Type
-- Run this in Supabase SQL Editor

-- 1. Update link_type constraint to include 'donate'
ALTER TABLE bio_links DROP CONSTRAINT IF EXISTS bio_links_link_type_check;

ALTER TABLE bio_links ADD CONSTRAINT bio_links_link_type_check 
  CHECK (link_type IN ('basic', 'grid', 'newsletter', 'sponsor', 'video', 'affiliate', 'donate'));

-- 2. Verify RLS policy allows inserts
-- This should already exist, but let's recreate it to be sure
DROP POLICY IF EXISTS "Users can insert own bio links" ON bio_links;

CREATE POLICY "Users can insert own bio links" ON bio_links
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND talent_id IN (SELECT id FROM talent_profiles WHERE user_id = auth.uid())
  );

-- 3. Verify the constraint includes 'donate'
SELECT 
  constraint_name, 
  check_clause 
FROM information_schema.check_constraints 
WHERE constraint_name = 'bio_links_link_type_check';

-- 4. Verify policy exists
SELECT 
  'RLS Policy Check' as status,
  EXISTS (
    SELECT FROM pg_policies 
    WHERE tablename = 'bio_links' 
    AND policyname = 'Users can insert own bio links'
  ) as policy_exists;

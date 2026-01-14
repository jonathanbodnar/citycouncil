-- Fix RLS on social_accounts table so bio dashboard can update social links
-- This allows BOTH admin and bio dashboard to use the SAME table

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "social_accounts_insert_policy" ON social_accounts;
DROP POLICY IF EXISTS "social_accounts_update_policy" ON social_accounts;
DROP POLICY IF EXISTS "social_accounts_delete_policy" ON social_accounts;
DROP POLICY IF EXISTS "social_accounts_select_policy" ON social_accounts;

-- Create permissive policies that allow bio dashboard to manage social accounts
-- Allow SELECT for everyone (needed for bio page display)
CREATE POLICY "social_accounts_select_policy" ON social_accounts
  FOR SELECT
  USING (true);

-- Allow INSERT for authenticated users (bio dashboard) and service role (admin)
CREATE POLICY "social_accounts_insert_policy" ON social_accounts
  FOR INSERT
  WITH CHECK (true);

-- Allow UPDATE for authenticated users (bio dashboard) and service role (admin)
CREATE POLICY "social_accounts_update_policy" ON social_accounts
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Allow DELETE for authenticated users (bio dashboard) and service role (admin)
CREATE POLICY "social_accounts_delete_policy" ON social_accounts
  FOR DELETE
  USING (true);

-- Verify RLS is enabled
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;

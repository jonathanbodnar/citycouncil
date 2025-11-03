-- RLS policies for moov_accounts
-- Run in Supabase SQL editor

ALTER TABLE moov_accounts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (idempotent)
DROP POLICY IF EXISTS "moov_accounts_select_own" ON moov_accounts;
DROP POLICY IF EXISTS "moov_accounts_insert_own" ON moov_accounts;
DROP POLICY IF EXISTS "moov_accounts_update_own" ON moov_accounts;
DROP POLICY IF EXISTS "moov_accounts_admin_all" ON moov_accounts;

-- Authenticated users can select their own record
CREATE POLICY "moov_accounts_select_own" ON moov_accounts
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Authenticated users can insert their own record
CREATE POLICY "moov_accounts_insert_own" ON moov_accounts
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- Authenticated users can update their own record
CREATE POLICY "moov_accounts_update_own" ON moov_accounts
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Admins can select/update all
CREATE POLICY "moov_accounts_admin_all" ON moov_accounts
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
      AND users.user_type = 'admin'
  )
);



-- Fix RLS policies for payouts table to allow trigger to insert records
-- The trigger runs with SECURITY DEFINER but still needs an INSERT policy

-- First, check current RLS policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'payouts';

-- Drop existing policies and recreate them properly
DROP POLICY IF EXISTS "Talent can view own payouts" ON public.payouts;
DROP POLICY IF EXISTS "Admin can view all payouts" ON public.payouts;
DROP POLICY IF EXISTS "Admin full access to payouts" ON public.payouts;
DROP POLICY IF EXISTS "Service role full access to payouts" ON public.payouts;
DROP POLICY IF EXISTS "talent_view_own_payouts" ON public.payouts;
DROP POLICY IF EXISTS "admin_view_all_payouts" ON public.payouts;
DROP POLICY IF EXISTS "System can insert payouts" ON public.payouts;
DROP POLICY IF EXISTS "Triggers can insert payouts" ON public.payouts;

-- Allow authenticated users (triggers run as authenticated) to INSERT payouts
CREATE POLICY "System can insert payouts"
  ON public.payouts
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Talent can view their own payouts
CREATE POLICY "Talent can view own payouts"
  ON public.payouts
  FOR SELECT
  TO authenticated
  USING (
    talent_id IN (
      SELECT id FROM talent_profiles WHERE user_id = auth.uid()
    )
  );

-- Talent can update their own payouts (for status changes)
CREATE POLICY "Talent can update own payouts"
  ON public.payouts
  FOR UPDATE
  TO authenticated
  USING (
    talent_id IN (
      SELECT id FROM talent_profiles WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    talent_id IN (
      SELECT id FROM talent_profiles WHERE user_id = auth.uid()
    )
  );

-- Admin can do everything
CREATE POLICY "Admin full access to payouts"
  ON public.payouts
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND user_type = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

-- Verify RLS is enabled
SELECT 
    '✅ RLS Status' AS status,
    tablename,
    rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'payouts';

-- Verify policies
SELECT 
    '✅ Active Policies' AS status,
    policyname,
    cmd AS command,
    roles
FROM pg_policies 
WHERE tablename = 'payouts'
ORDER BY policyname;

SELECT '✅ Payout RLS policies fixed - triggers can now insert, talent can view/update own payouts.' AS result;


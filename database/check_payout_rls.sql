-- Check RLS policies on payout tables

-- 1. Check if RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE tablename IN ('payouts', 'payout_batches');

-- 2. List all policies on payouts
SELECT 
  '📋 Payouts Policies' AS info,
  polname AS policy_name,
  polcmd AS command,
  polroles::regrole[] AS roles,
  polpermissive AS permissive,
  qual AS using_expression,
  with_check AS with_check_expression
FROM pg_policy
WHERE polrelid = 'public.payouts'::regclass;

-- 3. List all policies on payout_batches
SELECT 
  '📦 Payout Batches Policies' AS info,
  polname AS policy_name,
  polcmd AS command,
  polroles::regrole[] AS roles,
  polpermissive AS permissive,
  qual AS using_expression,
  with_check AS with_check_expression
FROM pg_policy
WHERE polrelid = 'public.payout_batches'::regclass;

-- 4. Check if admin role exists
SELECT 
  '👤 Admin Role Check' AS info,
  EXISTS (
    SELECT 1 FROM users WHERE role = 'admin'
  ) AS admin_exists;


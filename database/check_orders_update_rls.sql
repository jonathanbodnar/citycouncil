-- Check RLS policies specifically for orders UPDATE permission

-- 1. Check if RLS is enabled on orders table
SELECT 
  'RLS STATUS' as check_type,
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'orders';

-- 2. Show ALL policies on orders table
SELECT 
  'ALL POLICIES ON ORDERS' as check_type,
  policyname,
  permissive,
  roles,
  cmd as command,
  qual as using_clause,
  with_check as with_check_clause
FROM pg_policies
WHERE tablename = 'orders'
ORDER BY cmd, policyname;

-- 3. Specifically check for UPDATE policies
SELECT 
  'UPDATE POLICIES' as check_type,
  policyname,
  permissive,
  roles,
  qual as using_clause,
  with_check as with_check_clause
FROM pg_policies
WHERE tablename = 'orders'
  AND cmd = 'UPDATE';

-- 4. Check if there's a policy allowing talent to update their orders
SELECT 
  'TALENT UPDATE POLICY CHECK' as check_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'orders' 
        AND cmd = 'UPDATE'
        AND (
          policyname ILIKE '%talent%' 
          OR qual ILIKE '%talent%'
        )
    ) THEN '✅ Talent UPDATE policy exists'
    ELSE '❌ NO Talent UPDATE policy found!'
  END as status;

-- 5. Show the exact policy that should allow talent updates
SELECT 
  'EXPECTED POLICY' as info,
  polname as policyname,
  pg_get_expr(polqual, 'orders'::regclass) as using_expression,
  pg_get_expr(polwithcheck, 'orders'::regclass) as with_check_expression
FROM pg_policy
WHERE polrelid = 'orders'::regclass
  AND polcmd = 'w'  -- 'w' means UPDATE
ORDER BY polname;


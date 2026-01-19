-- FIX: Allow users to INSERT their own coupon usage
-- The previous RLS policy only allowed SELECT, so coupon usage was never being tracked
-- This is why WINNER100 could be used 4 times by the same customer

-- 1. Add INSERT policy for authenticated users to track their own coupon usage
CREATE POLICY "Users can insert own coupon usage"
  ON public.coupon_usage
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 2. Verify the policy was created
SELECT 
  'coupon_usage RLS policies' AS check_name,
  policyname,
  cmd
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'coupon_usage';

-- 3. Check how many times WINNER100 has been used (to see the damage)
SELECT 
  c.code,
  c.used_count,
  c.max_uses_per_user,
  COUNT(cu.id) AS actual_usage_count,
  COUNT(DISTINCT cu.user_id) AS unique_users
FROM public.coupons c
LEFT JOIN public.coupon_usage cu ON cu.coupon_id = c.id
WHERE c.code = 'WINNER100'
GROUP BY c.id, c.code, c.used_count, c.max_uses_per_user;

-- 4. Show all usage records for WINNER100
SELECT 
  cu.created_at,
  u.email,
  u.full_name,
  o.id as order_id,
  o.amount
FROM public.coupon_usage cu
JOIN public.coupons c ON c.id = cu.coupon_id
LEFT JOIN public.users u ON u.id = cu.user_id
LEFT JOIN public.orders o ON o.id = cu.order_id
WHERE c.code = 'WINNER100'
ORDER BY cu.created_at DESC;

SELECT '✅ RLS policy added - users can now track coupon usage!' AS status;

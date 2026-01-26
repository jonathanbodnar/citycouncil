-- FIX: Stop lloydmorman from using WINNER100 (free shoutout) multiple times
-- Run this in Supabase SQL Editor

-- 1. Check current state - how many times has WINNER100 been used?
SELECT 
  c.code,
  c.used_count,
  c.max_uses_per_user,
  c.max_uses AS total_max_uses
FROM public.coupons c
WHERE c.code = 'WINNER100';

-- 2. Find lloydmorman's user record
SELECT id, email, full_name, phone
FROM public.users
WHERE email ILIKE '%lloyd%' OR full_name ILIKE '%lloyd%';

-- 3. Check coupon_usage table for WINNER100
SELECT 
  cu.id,
  cu.used_at,
  u.email,
  u.full_name,
  o.customer_name,
  o.customer_email,
  o.total_amount
FROM public.coupon_usage cu
JOIN public.coupons c ON c.id = cu.coupon_id
LEFT JOIN public.users u ON u.id = cu.user_id
LEFT JOIN public.orders o ON o.id = cu.order_id
WHERE c.code = 'WINNER100'
ORDER BY cu.used_at DESC;

-- 4. Check all orders that used WINNER100
SELECT 
  o.id,
  o.created_at,
  o.customer_name,
  o.customer_email,
  o.coupon_code,
  o.discount_amount,
  o.total_amount,
  o.status
FROM public.orders o
WHERE o.coupon_code = 'WINNER100'
ORDER BY o.created_at DESC;

-- 5. Check RLS policies on coupon_usage
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'coupon_usage';

-- 6. ADD INSERT POLICY IF MISSING (this was the original bug)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'coupon_usage'
      AND cmd = 'INSERT'
  ) THEN
    CREATE POLICY "Users can insert own coupon usage"
      ON public.coupon_usage
      FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid());
    RAISE NOTICE 'INSERT policy created';
  ELSE
    RAISE NOTICE 'INSERT policy already exists';
  END IF;
END $$;

-- 7. MANUALLY ADD USAGE RECORD for lloydmorman to block future use
-- First, get the user_id and coupon_id
-- Then insert usage record

-- Get WINNER100 coupon id
WITH coupon AS (
  SELECT id FROM public.coupons WHERE code = 'WINNER100'
),
lloyd_user AS (
  SELECT id FROM public.users 
  WHERE email ILIKE '%lloyd%' OR full_name ILIKE '%lloyd%'
  LIMIT 1
)
INSERT INTO public.coupon_usage (coupon_id, user_id, order_id, used_at)
SELECT 
  c.id, 
  u.id, 
  NULL, 
  NOW()
FROM coupon c, lloyd_user u
WHERE NOT EXISTS (
  SELECT 1 FROM public.coupon_usage cu 
  WHERE cu.coupon_id = c.id AND cu.user_id = u.id
);

-- 8. OPTION: Deactivate WINNER100 entirely if being abused
-- Uncomment the line below to disable the coupon completely:
-- UPDATE public.coupons SET is_active = false WHERE code = 'WINNER100';

-- 9. OPTION: Set max total uses to stop further abuse
-- UPDATE public.coupons SET max_uses = used_count WHERE code = 'WINNER100';

-- 10. Verify the fix
SELECT 
  'Coupon Status' AS check_type,
  c.code,
  c.is_active,
  c.used_count,
  c.max_uses,
  c.max_uses_per_user
FROM public.coupons c
WHERE c.code = 'WINNER100';

SELECT 
  'Usage Records' AS check_type,
  COUNT(*) AS total_usage_records
FROM public.coupon_usage cu
JOIN public.coupons c ON c.id = cu.coupon_id
WHERE c.code = 'WINNER100';

SELECT '✅ Run complete - check results above' AS status;

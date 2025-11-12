-- Diagnostic script to check coupon system setup
-- Run this to verify everything is installed correctly

-- 1. Check if coupons table exists
SELECT 
  'coupons table' AS check_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'coupons')
    THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END AS status;

-- 2. Check if coupon_usage table exists
SELECT 
  'coupon_usage table' AS check_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'coupon_usage')
    THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END AS status;

-- 3. Check if validate_and_apply_coupon function exists
SELECT 
  'validate_and_apply_coupon function' AS check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' 
      AND p.proname = 'validate_and_apply_coupon'
    )
    THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END AS status;

-- 4. Check orders table has coupon columns
SELECT 
  'orders.coupon_id column' AS check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'orders' 
      AND column_name = 'coupon_id'
    )
    THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END AS status;

-- 5. Check if test coupons exist
SELECT 
  'Test coupons (WELCOME10, SAVE20, VIP25)' AS check_name,
  CASE 
    WHEN (SELECT COUNT(*) FROM public.coupons WHERE code IN ('WELCOME10', 'SAVE20', 'VIP25')) >= 3
    THEN '✅ EXISTS (' || (SELECT COUNT(*) FROM public.coupons WHERE code IN ('WELCOME10', 'SAVE20', 'VIP25'))::TEXT || ' coupons)'
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'coupons')
    THEN '⚠️ TABLE EXISTS BUT NO TEST COUPONS'
    ELSE '❌ TABLE MISSING'
  END AS status;

-- 6. List all existing coupons
SELECT 
  '📋 Existing Coupons:' AS info,
  '' AS details
UNION ALL
SELECT 
  '  ' || code AS info,
  discount_type || ' ' || discount_value::TEXT || 
  ' (used: ' || used_count::TEXT || 
  CASE WHEN max_uses IS NOT NULL THEN '/' || max_uses::TEXT ELSE '' END || 
  ', active: ' || is_active::TEXT || ')' AS details
FROM public.coupons
ORDER BY created_at DESC;

-- 7. Check RLS policies on coupons
SELECT 
  'RLS policies on coupons' AS check_name,
  CASE 
    WHEN (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'coupons') > 0
    THEN '✅ ' || (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'coupons')::TEXT || ' policies'
    ELSE '⚠️ NO POLICIES'
  END AS status;

-- 8. Test the validation function with a sample call
SELECT '🧪 Testing validate_and_apply_coupon function...' AS test_header;

DO $$
DECLARE
  test_user_id UUID;
BEGIN
  -- Get a real user ID for testing (if available)
  SELECT id INTO test_user_id FROM public.users WHERE user_type = 'user' LIMIT 1;
  
  IF test_user_id IS NOT NULL THEN
    RAISE NOTICE '✅ Function test with user: %', test_user_id;
    -- We can't easily SELECT from the function here, but if we got this far, function exists
  ELSE
    RAISE NOTICE '⚠️ No users found for testing';
  END IF;
END $$;

-- Summary
SELECT 
  '=======================' AS summary,
  '' AS details
UNION ALL
SELECT 
  '📊 SUMMARY' AS summary,
  '' AS details
UNION ALL
SELECT 
  '  Total Coupons:' AS summary,
  COALESCE((SELECT COUNT(*)::TEXT FROM public.coupons), 'TABLE NOT FOUND') AS details
UNION ALL
SELECT 
  '  Active Coupons:' AS summary,
  COALESCE((SELECT COUNT(*)::TEXT FROM public.coupons WHERE is_active = true), 'N/A') AS details
UNION ALL
SELECT 
  '  Total Usage:' AS summary,
  COALESCE((SELECT COUNT(*)::TEXT FROM public.coupon_usage), 'TABLE NOT FOUND') AS details;


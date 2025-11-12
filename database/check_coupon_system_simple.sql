-- Simplified diagnostic script to check coupon system setup
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

-- 5. List all columns in coupons table
SELECT 
  '📋 Coupons table columns:' AS info
UNION ALL
SELECT 
  '  - ' || column_name || ' (' || data_type || ')' AS info
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'coupons'
ORDER BY ordinal_position;

-- 6. Count existing coupons
SELECT 
  'Total Coupons:' AS check_name,
  COALESCE((SELECT COUNT(*)::TEXT FROM public.coupons), '0') AS status;

-- 7. List existing coupon codes
SELECT 
  'Existing coupon codes:' AS check_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM public.coupons)
    THEN (SELECT string_agg(code, ', ') FROM public.coupons)
    ELSE 'NONE'
  END AS status;

-- 8. Check RLS policies on coupons
SELECT 
  'RLS policies on coupons' AS check_name,
  CASE 
    WHEN (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'coupons') > 0
    THEN '✅ ' || (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'coupons')::TEXT || ' policies'
    ELSE '⚠️ NO POLICIES'
  END AS status;

-- 9. Summary
SELECT 
  '========================' AS summary
UNION ALL
SELECT 
  '📊 QUICK FIX: Run create_coupons_system_safe.sql to complete setup!' AS summary;


-- Check admin fee percentages for all talent profiles
-- Verify all talent have 25% admin fee set

-- 1. Show all talent with their admin fee settings
SELECT 
  tp.id,
  tp.username,
  COALESCE(u.full_name, tp.temp_full_name) as full_name,
  tp.admin_fee_percentage,
  tp.is_active,
  tp.onboarding_completed,
  CASE 
    WHEN tp.admin_fee_percentage IS NULL THEN '⚠️ NULL (will use default)'
    WHEN tp.admin_fee_percentage = 25 THEN '✅ Correct (25%)'
    ELSE '❌ INCORRECT (' || tp.admin_fee_percentage || '%)'
  END AS status
FROM public.talent_profiles tp
LEFT JOIN public.users u ON u.id = tp.user_id
ORDER BY tp.admin_fee_percentage NULLS FIRST, COALESCE(u.full_name, tp.temp_full_name);

-- 2. Summary counts
SELECT 
  '========================' AS summary,
  '' AS details
UNION ALL
SELECT 
  '📊 ADMIN FEE SUMMARY' AS summary,
  '' AS details
UNION ALL
SELECT 
  '  Total Talent:' AS summary,
  COUNT(*)::TEXT AS details
FROM public.talent_profiles
UNION ALL
SELECT 
  '  With 25% fee:' AS summary,
  COUNT(*)::TEXT AS details
FROM public.talent_profiles
WHERE admin_fee_percentage = 25
UNION ALL
SELECT 
  '  With NULL fee:' AS summary,
  COUNT(*)::TEXT AS details
FROM public.talent_profiles
WHERE admin_fee_percentage IS NULL
UNION ALL
SELECT 
  '  With other fee:' AS summary,
  COUNT(*)::TEXT AS details
FROM public.talent_profiles
WHERE admin_fee_percentage IS NOT NULL AND admin_fee_percentage != 25;

-- 3. List talent that need correction (not 25%)
SELECT 
  '========================' AS info
UNION ALL
SELECT 
  '⚠️ TALENT NEEDING CORRECTION:' AS info
UNION ALL
SELECT 
  '  ' || COALESCE(tp.username, u.full_name, tp.temp_full_name, 'ID: ' || tp.id::TEXT) || 
  ' (currently: ' || COALESCE(tp.admin_fee_percentage::TEXT, 'NULL') || '%)' AS info
FROM public.talent_profiles tp
LEFT JOIN public.users u ON u.id = tp.user_id
WHERE tp.admin_fee_percentage IS NULL OR tp.admin_fee_percentage != 25
ORDER BY COALESCE(u.full_name, tp.temp_full_name);


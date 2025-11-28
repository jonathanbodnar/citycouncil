-- Check JP Sears' onboarding data to see what happened

-- 1. Check ALL JP Sears talent profile data
SELECT 
  'JP SEARS FULL PROFILE' as check_type,
  *
FROM talent_profiles
WHERE temp_full_name ILIKE '%jp%sears%';

-- 2. Check if there's a NOT NULL constraint on pricing
SELECT 
  'PRICING COLUMN CONSTRAINTS' as check_type,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'talent_profiles'
  AND column_name IN ('pricing', 'corporate_pricing');

-- 3. Check other recently created talents to see if they have pricing
SELECT 
  'RECENT TALENTS WITH PRICING' as check_type,
  temp_full_name,
  pricing,
  corporate_pricing,
  created_at,
  is_active,
  CASE 
    WHEN pricing IS NULL THEN '❌ NULL pricing'
    ELSE '✅ Has pricing'
  END as status
FROM talent_profiles
WHERE created_at > NOW() - INTERVAL '30 days'
ORDER BY created_at DESC
LIMIT 10;


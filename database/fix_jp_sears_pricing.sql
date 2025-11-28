-- Fix JP Sears' missing pricing value

-- 1. Check current pricing value
SELECT 
  'CURRENT PRICING' as check_type,
  id,
  temp_full_name,
  pricing,
  corporate_pricing,
  is_active
FROM talent_profiles
WHERE temp_full_name ILIKE '%jp%sears%';

-- 2. Update JP Sears' pricing to correct value
UPDATE talent_profiles
SET 
  pricing = 150.00,  -- Set to $150 base price (public)
  corporate_pricing = 225.00  -- Set corporate pricing (estimated 1.5x)
WHERE temp_full_name ILIKE '%jp%sears%'
  AND pricing IS NULL;

-- 3. Verify the fix
SELECT 
  '✅ PRICING FIXED' as result,
  id,
  temp_full_name,
  pricing,
  corporate_pricing,
  is_active
FROM talent_profiles
WHERE temp_full_name ILIKE '%jp%sears%';

-- 4. Check if there are other talents with NULL pricing
SELECT 
  '⚠️ OTHER TALENTS WITH NULL PRICING' as warning,
  id,
  temp_full_name,
  pricing,
  is_active
FROM talent_profiles
WHERE pricing IS NULL
  AND is_active = true
ORDER BY temp_full_name;


-- Fix existing talent profiles with incorrect full_name values
-- Run this ONCE to correct data for existing talents

-- Step 1: Copy temp_full_name to full_name for profiles that have temp_full_name but no full_name
UPDATE talent_profiles
SET full_name = temp_full_name
WHERE temp_full_name IS NOT NULL
  AND (full_name IS NULL OR full_name = '');

-- Step 2: For profiles with a user_id, copy from users.full_name if talent_profiles.full_name is still blank
UPDATE talent_profiles tp
SET full_name = u.full_name
FROM users u
WHERE tp.user_id = u.id
  AND u.full_name IS NOT NULL
  AND (tp.full_name IS NULL OR tp.full_name = '');

-- Step 3: Verify the results
SELECT 
  tp.id,
  tp.username,
  tp.temp_full_name,
  tp.full_name,
  u.full_name as user_full_name,
  CASE 
    WHEN tp.full_name IS NOT NULL AND tp.full_name != '' THEN '✅ Has full_name'
    WHEN tp.temp_full_name IS NOT NULL THEN '⚠️ Has temp_full_name (needs migration)'
    WHEN u.full_name IS NOT NULL THEN '⚠️ Has user full_name (needs copy)'
    ELSE '❌ No full_name anywhere'
  END as status
FROM talent_profiles tp
LEFT JOIN users u ON tp.user_id = u.id
ORDER BY tp.created_at DESC;

-- Summary stats
SELECT 
  COUNT(*) as total_profiles,
  COUNT(CASE WHEN full_name IS NOT NULL AND full_name != '' THEN 1 END) as has_full_name,
  COUNT(CASE WHEN full_name IS NULL OR full_name = '' THEN 1 END) as missing_full_name,
  COUNT(CASE WHEN temp_full_name IS NOT NULL THEN 1 END) as has_temp_full_name
FROM talent_profiles;


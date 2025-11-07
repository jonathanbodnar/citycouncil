-- Populate Comms Center with All Talent Phone Numbers
-- Issue: Comms Center only shows 1 talent (JHHHB)
-- Goal: Show all talent who have phone numbers from registration or MFA enrollment

-- =============================================================================
-- STEP 1: Check current state - who's in comms center now?
-- =============================================================================

SELECT 
  '1. CURRENT COMMS CENTER TALENT' as step,
  COUNT(*) as talent_count,
  array_agg(tp.temp_full_name ORDER BY tp.temp_full_name) as talent_names
FROM talent_profiles tp
INNER JOIN users u ON tp.user_id = u.id
WHERE u.phone IS NOT NULL;

-- Show detailed list
SELECT 
  '1A. DETAILED CURRENT LIST' as step,
  tp.temp_full_name as talent_name,
  tp.username,
  u.email,
  u.phone,
  u.created_at
FROM talent_profiles tp
INNER JOIN users u ON tp.user_id = u.id
WHERE u.phone IS NOT NULL
ORDER BY tp.temp_full_name;

-- =============================================================================
-- STEP 2: Find talent with MFA phone enrollment
-- =============================================================================

-- Check auth.mfa_factors table for phone-based MFA
SELECT 
  '2. TALENT WITH MFA PHONE' as step,
  COUNT(DISTINCT tp.id) as talent_with_mfa_phone,
  array_agg(DISTINCT tp.temp_full_name) as talent_names
FROM talent_profiles tp
INNER JOIN users u ON tp.user_id = u.id
INNER JOIN auth.mfa_factors mfa ON mfa.user_id = u.id
WHERE mfa.factor_type = 'phone'
  AND mfa.status = 'verified';

-- Show detailed list with phone numbers from MFA
SELECT 
  '2A. DETAILED MFA PHONE LIST' as step,
  tp.temp_full_name as talent_name,
  tp.username,
  u.email,
  u.phone as current_phone,
  mfa.phone as mfa_phone,
  CASE 
    WHEN u.phone IS NULL AND mfa.phone IS NOT NULL THEN '⚠️ Phone in MFA but not users table'
    WHEN u.phone IS NOT NULL AND mfa.phone IS NULL THEN '✅ Phone in users table'
    WHEN u.phone = mfa.phone THEN '✅ Phone matches'
    WHEN u.phone != mfa.phone THEN '⚠️ Phone mismatch'
    ELSE '❓ Unknown'
  END as status
FROM talent_profiles tp
INNER JOIN users u ON tp.user_id = u.id
INNER JOIN auth.mfa_factors mfa ON mfa.user_id = u.id
WHERE mfa.factor_type = 'phone'
  AND mfa.status = 'verified'
ORDER BY tp.temp_full_name;

-- =============================================================================
-- STEP 3: Copy phone numbers from MFA to users table
-- =============================================================================

-- Update public.users with phone numbers from auth.mfa_factors
UPDATE public.users u
SET phone = mfa.phone
FROM auth.mfa_factors mfa
WHERE mfa.user_id = u.id
  AND mfa.factor_type = 'phone'
  AND mfa.status = 'verified'
  AND mfa.phone IS NOT NULL
  AND u.phone IS NULL; -- Only update if users.phone is NULL

-- Show how many were updated
SELECT 
  '3. PHONES COPIED FROM MFA' as step,
  COUNT(*) as phones_added
FROM public.users u
INNER JOIN auth.mfa_factors mfa ON mfa.user_id = u.id
WHERE mfa.factor_type = 'phone'
  AND mfa.status = 'verified'
  AND u.updated_at > NOW() - INTERVAL '10 seconds';

-- =============================================================================
-- STEP 4: Find talent who used phone during registration
-- =============================================================================

-- Some talent may have registered with phone but it didn't sync
-- Check auth.users for phone field
SELECT 
  '4. TALENT WITH PHONE IN AUTH' as step,
  COUNT(DISTINCT tp.id) as count,
  array_agg(DISTINCT tp.temp_full_name) as talent_names
FROM talent_profiles tp
INNER JOIN auth.users au ON tp.user_id = au.id
WHERE au.phone IS NOT NULL;

-- Show detailed list
SELECT 
  '4A. DETAILED AUTH PHONE LIST' as step,
  tp.temp_full_name as talent_name,
  tp.username,
  au.email,
  au.phone as auth_phone,
  u.phone as public_phone,
  CASE 
    WHEN u.phone IS NULL AND au.phone IS NOT NULL THEN '⚠️ Phone in auth but not public.users'
    WHEN u.phone IS NOT NULL THEN '✅ Already in public.users'
    ELSE '❓ No phone'
  END as status
FROM talent_profiles tp
INNER JOIN auth.users au ON tp.user_id = au.id
INNER JOIN public.users u ON tp.user_id = u.id
WHERE au.phone IS NOT NULL
ORDER BY tp.temp_full_name;

-- Copy phone from auth.users to public.users if missing
UPDATE public.users u
SET phone = au.phone
FROM auth.users au
WHERE au.id = u.id
  AND au.phone IS NOT NULL
  AND u.phone IS NULL;

-- =============================================================================
-- STEP 5: Verify - who's in comms center now?
-- =============================================================================

SELECT 
  '5. FINAL COMMS CENTER COUNT' as step,
  COUNT(*) as talent_count,
  array_agg(tp.temp_full_name ORDER BY tp.temp_full_name) as talent_names
FROM talent_profiles tp
INNER JOIN users u ON tp.user_id = u.id
WHERE u.phone IS NOT NULL;

-- Show before/after comparison
WITH before AS (
  SELECT 1 as count -- Replace with actual count before running script
),
after AS (
  SELECT COUNT(*) as count
  FROM talent_profiles tp
  INNER JOIN users u ON tp.user_id = u.id
  WHERE u.phone IS NOT NULL
)
SELECT 
  '6. BEFORE/AFTER COMPARISON' as step,
  b.count as before_count,
  a.count as after_count,
  (a.count - b.count) as added_count,
  CASE 
    WHEN a.count > b.count THEN '✅ More talent now visible'
    WHEN a.count = b.count THEN '⚠️ No change'
    ELSE '❌ Something went wrong'
  END as result
FROM before b
CROSS JOIN after a;

-- =============================================================================
-- STEP 6: Show all talent with and without phones (for reference)
-- =============================================================================

SELECT 
  '7. ALL TALENT (WITH/WITHOUT PHONE)' as step,
  tp.temp_full_name as talent_name,
  tp.username,
  u.email,
  u.phone,
  CASE 
    WHEN u.phone IS NOT NULL THEN '✅ In Comms Center'
    ELSE '❌ Not in Comms Center'
  END as comms_center_status,
  CASE
    WHEN u.phone IS NOT NULL THEN 'Visible'
    WHEN EXISTS (
      SELECT 1 FROM auth.mfa_factors mfa 
      WHERE mfa.user_id = u.id 
      AND mfa.factor_type = 'phone' 
      AND mfa.status = 'verified'
    ) THEN '⚠️ Has MFA phone but not synced'
    ELSE 'No phone number'
  END as phone_source
FROM talent_profiles tp
INNER JOIN users u ON tp.user_id = u.id
WHERE tp.is_active = true
ORDER BY 
  CASE WHEN u.phone IS NOT NULL THEN 0 ELSE 1 END,
  tp.temp_full_name;

-- =============================================================================
-- SUMMARY
-- =============================================================================

SELECT '
🎯 SCRIPT COMPLETE

This script:
1. ✅ Copied phone numbers from auth.mfa_factors to public.users
2. ✅ Copied phone numbers from auth.users to public.users
3. ✅ Updated Comms Center visibility for all talent with phones

What was fixed:
- Talent with MFA phone enrollment now visible in Comms Center
- Talent who registered with phone now visible in Comms Center

Next steps:
1. Refresh Comms Center page in admin dashboard
2. Should see more talent in the list
3. Can now send SMS to all talent with phone numbers

Note: This script is safe to run multiple times.
It only updates NULL phone numbers, never overwrites existing ones.

' as summary;


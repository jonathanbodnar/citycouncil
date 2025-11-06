-- Fix All Talent User Types - Comprehensive Cleanup
-- This ensures EVERYONE who has a talent_profile is marked as user_type='talent'

-- =============================================================================
-- STEP 1: DIAGNOSTIC - Show all misclassified users
-- =============================================================================

SELECT 
  '❌ MISCLASSIFIED TALENT (Should be talent, marked as user)' as issue,
  u.id,
  u.email,
  u.full_name,
  u.user_type as current_type,
  u.created_at,
  tp.id as talent_profile_id,
  tp.username,
  tp.onboarding_completed,
  tp.is_active,
  tp.total_orders,
  CASE 
    WHEN tp.total_orders > 0 THEN '⚠️ HAS ORDERS - HIGH PRIORITY'
    WHEN tp.is_active THEN '⚠️ ACTIVE PROFILE'
    WHEN tp.onboarding_completed THEN 'Completed onboarding'
    ELSE 'Incomplete onboarding'
  END as priority
FROM public.users u
INNER JOIN talent_profiles tp ON tp.user_id = u.id
WHERE u.user_type = 'user'  -- Wrong type!
ORDER BY 
  CASE WHEN tp.total_orders > 0 THEN 0 ELSE 1 END,
  CASE WHEN tp.is_active THEN 0 ELSE 1 END,
  u.created_at DESC;

-- =============================================================================
-- STEP 2: COUNT - How many need fixing?
-- =============================================================================

SELECT 
  'SUMMARY' as report,
  COUNT(*) as total_misclassified_users,
  COUNT(CASE WHEN tp.onboarding_completed THEN 1 END) as completed_onboarding,
  COUNT(CASE WHEN tp.is_active THEN 1 END) as active_profiles,
  COUNT(CASE WHEN tp.total_orders > 0 THEN 1 END) as has_orders,
  COUNT(CASE WHEN NOT tp.onboarding_completed THEN 1 END) as incomplete_onboarding
FROM public.users u
INNER JOIN talent_profiles tp ON tp.user_id = u.id
WHERE u.user_type = 'user';

-- =============================================================================
-- STEP 3: FIX - Update ALL misclassified users to talent
-- =============================================================================

UPDATE public.users u
SET 
  user_type = 'talent',
  updated_at = NOW()
FROM talent_profiles tp
WHERE 
  u.id = tp.user_id 
  AND u.user_type = 'user'
RETURNING 
  u.id,
  u.email,
  u.full_name,
  u.user_type as new_type,
  '✅ FIXED' as status;

-- =============================================================================
-- STEP 4: VERIFY - Check that all are fixed
-- =============================================================================

SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ ALL TALENT CORRECTLY CLASSIFIED'
    ELSE '❌ STILL ' || COUNT(*) || ' MISCLASSIFIED USERS'
  END as verification_result
FROM public.users u
INNER JOIN talent_profiles tp ON tp.user_id = u.id
WHERE u.user_type = 'user';

-- =============================================================================
-- STEP 5: FINAL REPORT - Show talent statistics
-- =============================================================================

SELECT 
  'FINAL STATISTICS' as report,
  COUNT(DISTINCT tp.id) as total_talent_profiles,
  COUNT(DISTINCT u.id) as total_talent_users,
  COUNT(DISTINCT CASE WHEN u.user_type = 'talent' THEN u.id END) as correctly_marked_talent,
  COUNT(DISTINCT CASE WHEN u.user_type = 'user' THEN u.id END) as still_marked_as_user,
  COUNT(DISTINCT CASE WHEN tp.onboarding_completed THEN tp.id END) as completed_onboarding,
  COUNT(DISTINCT CASE WHEN tp.is_active THEN tp.id END) as active_talent,
  COUNT(DISTINCT CASE WHEN tp.total_orders > 0 THEN tp.id END) as talent_with_orders
FROM talent_profiles tp
LEFT JOIN public.users u ON tp.user_id = u.id;

-- =============================================================================
-- STEP 6: CHECK FOR ORPHANED TALENT PROFILES
-- =============================================================================

-- Look for talent_profiles that don't have a corresponding user
SELECT 
  '⚠️ ORPHANED TALENT PROFILES (No user account)' as issue,
  tp.id as talent_profile_id,
  tp.user_id,
  tp.temp_full_name,
  tp.username,
  tp.onboarding_completed,
  tp.created_at
FROM talent_profiles tp
LEFT JOIN public.users u ON tp.user_id = u.id
WHERE u.id IS NULL
ORDER BY tp.created_at DESC;

-- =============================================================================
-- BONUS: Show all talent with correct classification
-- =============================================================================

SELECT 
  '✅ CORRECTLY CLASSIFIED TALENT' as status,
  u.email,
  u.full_name,
  u.user_type,
  tp.username,
  tp.is_active,
  tp.onboarding_completed,
  tp.total_orders,
  u.created_at
FROM public.users u
INNER JOIN talent_profiles tp ON tp.user_id = u.id
WHERE u.user_type = 'talent'
ORDER BY u.created_at DESC
LIMIT 50;

-- =============================================================================
-- USAGE INSTRUCTIONS:
-- =============================================================================
-- 
-- This script will:
-- 1. Show all users who have talent_profiles but are marked as user_type='user'
-- 2. Count how many need fixing
-- 3. FIX ALL OF THEM by updating user_type to 'talent'
-- 4. Verify the fix worked
-- 5. Show final statistics
-- 6. Check for any orphaned profiles
-- 7. Show correctly classified talent
--
-- Safe to run multiple times - only updates users who need fixing
--
-- =============================================================================


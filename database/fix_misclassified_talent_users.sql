-- Fix Misclassified Talent Users
-- This script fixes users who were created through talent onboarding
-- but were incorrectly marked as user_type='user' instead of 'talent'

-- ==============================================================================
-- STEP 1: IDENTIFY AFFECTED USERS (RUN THIS FIRST TO SEE WHAT WILL BE FIXED)
-- ==============================================================================

SELECT 
  u.id,
  u.email,
  u.full_name,
  u.user_type as current_type,
  u.created_at as user_created,
  tp.id as talent_profile_id,
  tp.username,
  tp.onboarding_completed,
  tp.created_at as profile_created,
  CASE 
    WHEN tp.id IS NOT NULL THEN 'Has talent profile - NEEDS FIX'
    ELSE 'No talent profile'
  END as status
FROM public.users u
LEFT JOIN talent_profiles tp ON tp.user_id = u.id
WHERE 
  -- User is marked as 'user' but has a talent profile
  u.user_type = 'user' 
  AND tp.id IS NOT NULL
ORDER BY u.created_at DESC;

-- ==============================================================================
-- STEP 2: COUNT AFFECTED USERS
-- ==============================================================================

SELECT 
  COUNT(*) as misclassified_users,
  COUNT(CASE WHEN tp.onboarding_completed THEN 1 END) as completed_onboarding,
  COUNT(CASE WHEN NOT tp.onboarding_completed THEN 1 END) as incomplete_onboarding
FROM public.users u
INNER JOIN talent_profiles tp ON tp.user_id = u.id
WHERE u.user_type = 'user';

-- ==============================================================================
-- STEP 3: DETAILED REPORT OF AFFECTED USERS
-- ==============================================================================

SELECT 
  u.id,
  u.email,
  u.full_name,
  u.phone,
  u.user_type,
  u.created_at as account_created,
  tp.username,
  tp.category,
  tp.pricing,
  tp.onboarding_completed,
  tp.is_active,
  tp.total_orders,
  tp.fulfilled_orders,
  o.order_count,
  CASE 
    WHEN o.order_count > 0 THEN '⚠️  HAS ORDERS - HIGH PRIORITY'
    WHEN tp.is_active THEN '⚠️  ACTIVE PROFILE'
    WHEN tp.onboarding_completed THEN 'Completed onboarding'
    ELSE 'Incomplete onboarding'
  END as priority
FROM public.users u
INNER JOIN talent_profiles tp ON tp.user_id = u.id
LEFT JOIN (
  SELECT talent_id, COUNT(*) as order_count 
  FROM orders 
  GROUP BY talent_id
) o ON o.talent_id = tp.id
WHERE u.user_type = 'user'
ORDER BY 
  CASE WHEN o.order_count > 0 THEN 0 ELSE 1 END, -- Orders first
  CASE WHEN tp.is_active THEN 0 ELSE 1 END,      -- Active profiles next
  u.created_at DESC;

-- ==============================================================================
-- STEP 4: FIX THE MISCLASSIFIED USERS (EXECUTE THIS TO APPLY THE FIX)
-- ==============================================================================

-- Update all users who have talent_profiles to be user_type='talent'
UPDATE public.users u
SET 
  user_type = 'talent',
  updated_at = NOW()
FROM talent_profiles tp
WHERE 
  u.id = tp.user_id 
  AND u.user_type = 'user';

-- ==============================================================================
-- STEP 5: VERIFY THE FIX
-- ==============================================================================

-- Should return 0 rows if fix was successful
SELECT 
  u.id,
  u.email,
  u.user_type,
  tp.id as talent_profile_id
FROM public.users u
INNER JOIN talent_profiles tp ON tp.user_id = u.id
WHERE u.user_type = 'user';

-- ==============================================================================
-- STEP 6: FINAL SUMMARY
-- ==============================================================================

SELECT 
  'Total Users' as category,
  COUNT(*) as count
FROM public.users
UNION ALL
SELECT 
  'Talent Type Users',
  COUNT(*)
FROM public.users
WHERE user_type = 'talent'
UNION ALL
SELECT 
  'Regular Type Users',
  COUNT(*)
FROM public.users
WHERE user_type = 'user'
UNION ALL
SELECT 
  'Talent Profiles',
  COUNT(*)
FROM talent_profiles
UNION ALL
SELECT 
  'Talent With Profiles',
  COUNT(*)
FROM public.users u
INNER JOIN talent_profiles tp ON tp.user_id = u.id
WHERE u.user_type = 'talent'
UNION ALL
SELECT 
  'Mismatched (Still Broken)',
  COUNT(*)
FROM public.users u
INNER JOIN talent_profiles tp ON tp.user_id = u.id
WHERE u.user_type = 'user';

-- ==============================================================================
-- STEP 7: CHECK FOR ORDERS FROM AFFECTED TALENT
-- ==============================================================================

-- Find orders where talent was misclassified
SELECT 
  o.id as order_id,
  o.status,
  o.created_at as order_date,
  o.total_amount,
  u.email as talent_email,
  u.user_type as talent_type,
  tp.username as talent_username,
  customer.email as customer_email
FROM orders o
INNER JOIN talent_profiles tp ON o.talent_id = tp.id
INNER JOIN public.users u ON tp.user_id = u.id
LEFT JOIN public.users customer ON o.user_id = customer.id
WHERE u.user_type = 'user'  -- Was misclassified
ORDER BY o.created_at DESC;

-- ==============================================================================
-- USAGE INSTRUCTIONS:
-- ==============================================================================
-- 
-- 1. Run STEP 1 to see which users will be affected
-- 2. Run STEP 2 to get a count
-- 3. Run STEP 3 for detailed report (save this for records!)
-- 4. Run STEP 4 to FIX all misclassified users
-- 5. Run STEP 5 to verify (should show 0 results)
-- 6. Run STEP 6 for final summary
-- 7. Run STEP 7 to check if any orders were affected
--
-- This script is SAFE to run multiple times - it only updates users who
-- have talent_profiles but are marked as user_type='user'
-- ==============================================================================


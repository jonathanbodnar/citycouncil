-- Cleanup Broken User Account and Allow Re-registration
-- Use this to fix individual users who got stuck during failed onboarding

-- =============================================================================
-- STEP 1: IDENTIFY THE USER (Check what will be deleted)
-- =============================================================================

-- Replace 'talent9@gmail.com' with the actual email
SELECT 
  'auth.users' as table_name,
  id,
  email,
  email_confirmed_at,
  created_at
FROM auth.users
WHERE email = 'talent9@gmail.com'

UNION ALL

SELECT 
  'public.users' as table_name,
  id,
  email,
  CAST(user_type AS text) as email_confirmed_at,
  created_at
FROM public.users
WHERE email = 'talent9@gmail.com'

UNION ALL

SELECT 
  'talent_profiles' as table_name,
  tp.id,
  u.email,
  CAST(tp.onboarding_completed AS text),
  tp.created_at
FROM talent_profiles tp
LEFT JOIN public.users u ON tp.user_id = u.id
WHERE u.email = 'talent9@gmail.com' OR tp.user_id IN (
  SELECT id FROM auth.users WHERE email = 'talent9@gmail.com'
);

-- =============================================================================
-- STEP 2: DELETE FROM public.users (Run this first)
-- =============================================================================

-- This removes the broken user record from public.users
DELETE FROM public.users
WHERE email = 'talent9@gmail.com'
RETURNING id, email, user_type;

-- =============================================================================
-- STEP 3: DELETE FROM talent_profiles (if exists)
-- =============================================================================

-- Remove any orphaned talent profile
DELETE FROM talent_profiles
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'talent9@gmail.com'
)
RETURNING id, user_id, username;

-- =============================================================================
-- STEP 4: DELETE FROM auth.users (Run this last - REQUIRES ADMIN)
-- =============================================================================

-- This requires service role / admin access
-- Run in Supabase Dashboard SQL Editor with admin privileges
DELETE FROM auth.users
WHERE email = 'talent9@gmail.com'
RETURNING id, email;

-- =============================================================================
-- STEP 5: VERIFY CLEANUP (Should return 0 rows)
-- =============================================================================

SELECT COUNT(*) as remaining_in_auth FROM auth.users WHERE email = 'talent9@gmail.com'
UNION ALL
SELECT COUNT(*) FROM public.users WHERE email = 'talent9@gmail.com'
UNION ALL
SELECT COUNT(*) FROM talent_profiles WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'talent9@gmail.com'
);

-- =============================================================================
-- ALTERNATIVE: QUICK FIX - Just Change user_type to 'talent'
-- =============================================================================

-- If you don't want to delete and recreate, just fix the user_type:
UPDATE public.users
SET 
  user_type = 'talent',
  updated_at = NOW()
WHERE email = 'talent9@gmail.com'
RETURNING id, email, user_type;

-- And create talent profile if missing:
INSERT INTO talent_profiles (
  user_id,
  category,
  bio,
  pricing,
  fulfillment_time_hours,
  is_featured,
  is_active,
  total_orders,
  fulfilled_orders,
  average_rating,
  admin_fee_percentage,
  first_orders_promo_active,
  onboarding_completed
)
SELECT 
  u.id,
  'other',
  '',
  299.99,
  48,
  false,
  false,
  0,
  0,
  0,
  25,
  true,
  false
FROM public.users u
WHERE u.email = 'talent9@gmail.com'
  AND NOT EXISTS (
    SELECT 1 FROM talent_profiles WHERE user_id = u.id
  )
RETURNING id, user_id;

-- =============================================================================
-- USAGE:
-- =============================================================================
-- 
-- Option A: Delete and let them re-register (clean slate)
--   1. Run STEP 1 to see what exists
--   2. Run STEP 2, 3, 4 to delete everything
--   3. Run STEP 5 to verify
--   4. User can now register fresh
--
-- Option B: Fix existing account (faster)
--   1. Run "ALTERNATIVE: QUICK FIX" section
--   2. User can now login and continue onboarding
--
-- =============================================================================


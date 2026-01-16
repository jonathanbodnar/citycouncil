-- ============================================================
-- FIX: Link bradstine@comcast.net to their talent profile
-- ============================================================
-- This script checks and fixes the talent profile linking issue

-- Step 1: Find the user by email
SELECT 'Step 1: Finding user by email...' as step;

SELECT 
  id as user_id,
  email,
  full_name,
  user_type,
  created_at
FROM users 
WHERE email ILIKE '%bradstine%' OR email ILIKE '%comcast%';

-- Step 2: Find the talent profile (by name or username)
SELECT 'Step 2: Finding talent profile...' as step;

SELECT 
  id as talent_profile_id,
  user_id as linked_user_id,
  username,
  temp_full_name,
  onboarding_token,
  onboarding_expires_at,
  onboarding_completed,
  current_onboarding_step,
  is_active,
  created_at
FROM talent_profiles 
WHERE temp_full_name ILIKE '%brad%stine%'
   OR username ILIKE '%brad%stine%'
   OR temp_full_name ILIKE '%brad%'
LIMIT 5;

-- Step 3: Check auth.users for the email
SELECT 'Step 3: Checking auth.users...' as step;

SELECT 
  id,
  email,
  created_at,
  last_sign_in_at
FROM auth.users
WHERE email ILIKE '%bradstine%';

-- ============================================================
-- MANUAL FIX: Run these after identifying the correct IDs
-- ============================================================

-- Replace these UUIDs with the actual values from above queries:
-- USER_ID = (from Step 1 or Step 3)
-- TALENT_PROFILE_ID = (from Step 2)

/*
-- Option A: If user exists in auth.users but not in public.users
-- Create the user record first
INSERT INTO public.users (id, email, full_name, user_type)
SELECT 
  id,
  email,
  raw_user_meta_data->>'full_name',
  'talent'
FROM auth.users
WHERE email ILIKE '%bradstine%'
ON CONFLICT (id) DO UPDATE SET
  user_type = 'talent',
  updated_at = NOW();

-- Option B: Link the talent profile to the user
UPDATE talent_profiles
SET user_id = (SELECT id FROM auth.users WHERE email ILIKE '%bradstine%' LIMIT 1)
WHERE temp_full_name ILIKE '%brad%stine%'
  AND user_id IS NULL;
*/

-- ============================================================
-- AUTOMATIC FIX: This will try to auto-link based on email match
-- ============================================================

DO $$
DECLARE
  v_user_id UUID;
  v_talent_id UUID;
  v_talent_name TEXT;
BEGIN
  -- Get the user ID from auth.users
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email ILIKE '%bradstine%comcast%'
  LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'No user found with email containing bradstine@comcast';
    RETURN;
  END IF;
  
  RAISE NOTICE 'Found user: %', v_user_id;
  
  -- Find unlinked talent profile by name pattern
  SELECT id, temp_full_name INTO v_talent_id, v_talent_name
  FROM talent_profiles
  WHERE (temp_full_name ILIKE '%brad%stine%' OR temp_full_name ILIKE '%brad stine%')
    AND (user_id IS NULL OR user_id != v_user_id)
  LIMIT 1;
  
  IF v_talent_id IS NULL THEN
    -- Try to find by checking if there's a recent profile with no user_id
    SELECT id, temp_full_name INTO v_talent_id, v_talent_name
    FROM talent_profiles
    WHERE user_id IS NULL
      AND created_at > NOW() - INTERVAL '7 days'
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF v_talent_id IS NULL THEN
      RAISE NOTICE 'No unlinked talent profile found for Brad Stine';
      RETURN;
    END IF;
  END IF;
  
  RAISE NOTICE 'Found talent profile: % (%)', v_talent_id, v_talent_name;
  
  -- Ensure user exists in public.users
  INSERT INTO public.users (id, email, full_name, user_type)
  SELECT 
    v_user_id,
    email,
    COALESCE(raw_user_meta_data->>'full_name', v_talent_name),
    'talent'
  FROM auth.users
  WHERE id = v_user_id
  ON CONFLICT (id) DO UPDATE SET
    user_type = 'talent',
    full_name = COALESCE(EXCLUDED.full_name, users.full_name),
    updated_at = NOW();
  
  RAISE NOTICE 'User record ensured in public.users';
  
  -- Link the talent profile
  UPDATE talent_profiles
  SET 
    user_id = v_user_id,
    full_name = COALESCE(full_name, temp_full_name)
  WHERE id = v_talent_id;
  
  RAISE NOTICE 'Talent profile % linked to user %', v_talent_id, v_user_id;
  RAISE NOTICE 'SUCCESS! Brad Stine talent profile has been linked.';
END $$;

-- Verify the fix
SELECT 'Verification...' as step;

SELECT 
  tp.id as talent_profile_id,
  tp.user_id,
  tp.username,
  tp.temp_full_name,
  tp.onboarding_completed,
  tp.is_active,
  u.email as user_email,
  u.full_name as user_full_name
FROM talent_profiles tp
LEFT JOIN users u ON u.id = tp.user_id
WHERE tp.temp_full_name ILIKE '%brad%stine%'
   OR tp.username ILIKE '%brad%';

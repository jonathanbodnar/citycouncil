-- Cleanup Test Accounts from Failed Onboarding Attempts
-- Run this to clean up broken accounts so they can re-register

-- =============================================================================
-- STEP 1: LIST ALL TEST ACCOUNTS (Check before deleting)
-- =============================================================================

-- Show all recently created accounts (last 24 hours)
SELECT 
  'RECENT AUTH USERS' as check_name,
  id,
  email,
  email_confirmed_at,
  created_at,
  CASE 
    WHEN email_confirmed_at IS NULL THEN '⚠️ Unconfirmed'
    ELSE '✓ Confirmed'
  END as status
FROM auth.users
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- Show corresponding public.users records
SELECT 
  'RECENT PUBLIC USERS' as check_name,
  u.id,
  u.email,
  u.user_type,
  u.created_at,
  CASE 
    WHEN tp.id IS NOT NULL THEN '✓ Has talent profile'
    ELSE '✗ No talent profile'
  END as profile_status
FROM public.users u
LEFT JOIN talent_profiles tp ON tp.user_id = u.id
WHERE u.created_at > NOW() - INTERVAL '24 hours'
ORDER BY u.created_at DESC;

-- =============================================================================
-- STEP 2: DELETE SPECIFIC EMAIL (Replace with actual email)
-- =============================================================================

-- Example: Delete lasttest@shoutout.us or any other test email
-- UNCOMMENT and REPLACE EMAIL to use:

/*
DO $$
DECLARE
  target_email text := 'lasttest@shoutout.us'; -- CHANGE THIS
  user_uuid uuid;
BEGIN
  -- Get user ID
  SELECT id INTO user_uuid FROM auth.users WHERE email = target_email;
  
  IF user_uuid IS NULL THEN
    RAISE NOTICE 'No user found with email: %', target_email;
    RETURN;
  END IF;
  
  -- Delete from talent_profiles first (foreign key)
  DELETE FROM talent_profiles WHERE user_id = user_uuid;
  RAISE NOTICE 'Deleted talent_profile for user: %', target_email;
  
  -- Delete from public.users
  DELETE FROM public.users WHERE id = user_uuid;
  RAISE NOTICE 'Deleted public.users record for user: %', target_email;
  
  -- Delete from auth.users (requires admin)
  DELETE FROM auth.users WHERE id = user_uuid;
  RAISE NOTICE '✓ Successfully deleted all records for user: %', target_email;
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '✗ Error deleting user: %', SQLERRM;
END $$;
*/

-- =============================================================================
-- STEP 3: BULK DELETE ALL UNCONFIRMED USERS (Last 24h)
-- =============================================================================

-- This deletes ALL users from last 24h who never confirmed email
-- UNCOMMENT to use (CAUTION: Bulk delete!)

/*
DO $$
DECLARE
  deleted_count int := 0;
  user_record RECORD;
BEGIN
  FOR user_record IN 
    SELECT id, email FROM auth.users 
    WHERE created_at > NOW() - INTERVAL '24 hours'
    AND email_confirmed_at IS NULL
  LOOP
    -- Delete related records
    DELETE FROM talent_profiles WHERE user_id = user_record.id;
    DELETE FROM public.users WHERE id = user_record.id;
    DELETE FROM auth.users WHERE id = user_record.id;
    
    deleted_count := deleted_count + 1;
    RAISE NOTICE 'Deleted unconfirmed user: %', user_record.email;
  END LOOP;
  
  RAISE NOTICE '✓ Deleted % unconfirmed users', deleted_count;
END $$;
*/

-- =============================================================================
-- STEP 4: VERIFY CLEANUP
-- =============================================================================

-- Check if email is now available for re-registration
-- UNCOMMENT and REPLACE EMAIL:

/*
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM auth.users WHERE email = 'lasttest@shoutout.us')
    THEN '✗ Email still exists - delete failed'
    ELSE '✓ Email available - can re-register'
  END as status;
*/

-- =============================================================================
-- ALTERNATIVE: Just check what emails are being used
-- =============================================================================

SELECT 
  email,
  email_confirmed_at IS NOT NULL as confirmed,
  created_at
FROM auth.users
WHERE email ILIKE '%test%' 
   OR email ILIKE '%another%'
   OR email ILIKE '%talent%'
   OR email ILIKE '%robin%'
ORDER BY created_at DESC
LIMIT 20;


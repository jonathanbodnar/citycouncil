-- FIX: Remove NOT NULL constraint on user_type column
-- OR add a DEFAULT value

-- =============================================================================
-- SOLUTION 1: Make user_type NULLABLE (Recommended)
-- =============================================================================
-- This allows the column to be NULL initially, then our code sets it to 'talent'

ALTER TABLE public.users 
ALTER COLUMN user_type DROP NOT NULL;

-- =============================================================================
-- SOLUTION 2: Add DEFAULT value (Alternative)
-- =============================================================================
-- This sets user_type='user' by default, then our UPSERT changes it to 'talent'
-- ONLY USE THIS IF SOLUTION 1 DOESN'T WORK

-- ALTER TABLE public.users 
-- ALTER COLUMN user_type SET DEFAULT 'user';

-- =============================================================================
-- VERIFY THE FIX
-- =============================================================================

-- Check the column definition
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'users' 
  AND table_schema = 'public'
  AND column_name = 'user_type';

-- Expected result:
-- is_nullable should be 'YES' (if using Solution 1)
-- OR column_default should be 'user' (if using Solution 2)

-- =============================================================================
-- TEST: Try creating a user with NULL user_type
-- =============================================================================

DO $$
DECLARE
  test_id uuid := gen_random_uuid();
BEGIN
  -- This should now work (no error about NOT NULL)
  INSERT INTO public.users (id, email, user_type, full_name)
  VALUES (test_id, 'null-test@test.com', NULL, 'Test User');
  
  RAISE NOTICE '✓ TEST PASSED: Can insert with NULL user_type';
  
  -- Clean up
  DELETE FROM public.users WHERE id = test_id;
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '✗ TEST FAILED: %', SQLERRM;
END $$;

-- =============================================================================
-- SUMMARY
-- =============================================================================

SELECT 
  'Fix Applied' as status,
  'user_type can now be NULL - registration should work!' as message;


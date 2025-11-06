-- Cleanup script for ghost/orphaned user accounts
-- USE WITH CAUTION - This permanently deletes user data
-- Replace 'your-email@example.com' with the email to clean up

-- STEP 1: Check what will be deleted (RUN THIS FIRST!)
SELECT 
  'Will delete from auth.users:' as action,
  id, 
  email, 
  created_at
FROM auth.users 
WHERE email = 'jakhfkshadkadg@gmail.com';  -- REPLACE THIS EMAIL

SELECT 
  'Will delete from public.users:' as action,
  id, 
  email, 
  user_type
FROM public.users 
WHERE email = 'jakhfkshadkadg@gmail.com';  -- REPLACE THIS EMAIL

-- STEP 2: If you're SURE you want to delete, uncomment and run these:

-- Delete from public.users first (foreign key constraints)
-- DELETE FROM public.users 
-- WHERE email = 'jakhfkshadkadg@gmail.com';  -- REPLACE THIS EMAIL

-- Delete from auth.users (requires admin privileges)
-- DELETE FROM auth.users 
-- WHERE email = 'jakhfkshadkadg@gmail.com';  -- REPLACE THIS EMAIL

-- STEP 3: Verify deletion
-- SELECT * FROM auth.users WHERE email = 'jakhfkshadkadg@gmail.com';
-- SELECT * FROM public.users WHERE email = 'jakhfkshadkadg@gmail.com';


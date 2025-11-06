-- Debug script to check if a user email exists
-- Replace 'your-email@example.com' with the actual email you tried to register

-- Check in public.users table
SELECT 
  id, 
  email, 
  user_type, 
  created_at,
  'public.users' as source
FROM public.users 
WHERE email = 'jakhfkshadkadg@gmail.com';  -- REPLACE THIS EMAIL

-- Check in auth.users table (if you have access)
-- Note: This requires service role or direct database access
SELECT 
  id, 
  email, 
  email_confirmed_at,
  created_at,
  'auth.users' as source
FROM auth.users 
WHERE email = 'jakhfkshadkadg@gmail.com';  -- REPLACE THIS EMAIL

-- Check if there's an orphaned talent profile
SELECT 
  tp.id as talent_id,
  tp.user_id,
  tp.temp_full_name,
  tp.onboarding_token,
  tp.onboarding_completed,
  tp.created_at
FROM talent_profiles tp
LEFT JOIN public.users u ON tp.user_id = u.id
WHERE u.email = 'jakhfkshadkadg@gmail.com'  -- REPLACE THIS EMAIL
   OR tp.user_id IN (
     SELECT id FROM auth.users WHERE email = 'jakhfkshadkadg@gmail.com'  -- REPLACE THIS EMAIL
   );


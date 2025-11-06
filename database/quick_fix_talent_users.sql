-- QUICK FIX: Convert All Misclassified Users to Talent
-- Run this single query to fix all users who have talent_profiles

-- Before running, check how many will be affected:
SELECT COUNT(*) as users_to_fix 
FROM public.users u
INNER JOIN talent_profiles tp ON tp.user_id = u.id
WHERE u.user_type = 'user';

-- Execute the fix:
UPDATE public.users u
SET 
  user_type = 'talent',
  updated_at = NOW()
FROM talent_profiles tp
WHERE 
  u.id = tp.user_id 
  AND u.user_type = 'user'
RETURNING u.id, u.email, u.full_name, u.user_type;

-- Verify (should return 0):
SELECT COUNT(*) as remaining_misclassified
FROM public.users u
INNER JOIN talent_profiles tp ON tp.user_id = u.id
WHERE u.user_type = 'user';


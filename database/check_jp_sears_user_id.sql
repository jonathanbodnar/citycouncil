-- Check JP Sears' user_id and account status

SELECT 
  'JP SEARS TALENT PROFILE' as check_type,
  tp.id as talent_id,
  tp.user_id,
  tp.temp_full_name,
  tp.username,
  tp.is_active,
  tp.current_onboarding_step,
  tp.created_at,
  tp.updated_at
FROM talent_profiles tp
WHERE tp.username = 'jpsears' OR tp.temp_full_name ILIKE '%jp%sears%';

-- Check if the user exists in auth.users
SELECT 
  'JP SEARS AUTH USER' as check_type,
  u.id,
  u.email,
  u.created_at,
  u.last_sign_in_at
FROM auth.users u
WHERE u.email ILIKE '%sears%' OR u.id IN (
  SELECT user_id FROM talent_profiles WHERE username = 'jpsears'
);

-- Check if user exists in public.users
SELECT 
  'JP SEARS PUBLIC USER' as check_type,
  u.id,
  u.email,
  u.full_name,
  u.user_type,
  u.phone,
  u.created_at
FROM public.users u
WHERE u.email ILIKE '%sears%' OR u.id IN (
  SELECT user_id FROM talent_profiles WHERE username = 'jpsears'
);

-- Check the join that the frontend uses
SELECT 
  'FRONTEND JOIN RESULT' as check_type,
  tp.id as talent_id,
  tp.user_id,
  tp.username,
  u.id as user_table_id,
  u.email,
  u.full_name
FROM talent_profiles tp
LEFT JOIN public.users u ON tp.user_id = u.id
WHERE tp.username = 'jpsears';


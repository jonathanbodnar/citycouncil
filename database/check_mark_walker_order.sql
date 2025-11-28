-- Check Mark Walker's account and order status
-- Email: trainleader21@gmail.com

-- 1. Find the user account
SELECT 
  id,
  email,
  phone,
  full_name,
  user_type,
  created_at,
  last_login
FROM public.users
WHERE email = 'trainleader21@gmail.com';

-- 2. Check for any orders (including failed ones)
SELECT 
  o.id,
  o.user_id,
  o.talent_id,
  o.status,
  o.amount,
  o.request_details,
  o.created_at,
  t.temp_full_name as talent_name
FROM orders o
LEFT JOIN talent_profiles t ON o.talent_id = t.id
WHERE o.user_id IN (
  SELECT id FROM public.users WHERE email = 'trainleader21@gmail.com'
)
ORDER BY o.created_at DESC;

-- 3. Check notifications sent to this user
SELECT 
  n.id,
  n.type,
  n.title,
  n.message,
  n.is_read,
  n.created_at
FROM notifications n
WHERE n.user_id IN (
  SELECT id FROM public.users WHERE email = 'trainleader21@gmail.com'
)
ORDER BY n.created_at DESC;

-- 4. Check auth.users metadata
SELECT 
  id,
  email,
  phone,
  email_confirmed_at,
  phone_confirmed_at,
  created_at,
  last_sign_in_at,
  raw_user_meta_data
FROM auth.users
WHERE email = 'trainleader21@gmail.com';

-- 5. Check for any recent failed order attempts (last 2 hours)
SELECT 
  o.id,
  o.user_id,
  o.talent_id,
  o.status,
  o.amount,
  o.created_at,
  u.email,
  u.phone
FROM orders o
LEFT JOIN public.users u ON o.user_id = u.id
WHERE o.created_at > NOW() - INTERVAL '2 hours'
  AND (u.email = 'trainleader21@gmail.com' OR u.id IN (
    SELECT id FROM public.users WHERE email = 'trainleader21@gmail.com'
  ))
ORDER BY o.created_at DESC;


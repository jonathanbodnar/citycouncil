-- Comprehensive search for ANY orders by Mark Walker
-- Email: trainleader21@gmail.com

-- 1. Get Mark Walker's user ID
SELECT 
  id as user_id,
  email,
  phone,
  full_name,
  created_at,
  last_login
FROM public.users
WHERE email = 'trainleader21@gmail.com';

-- 2. Search for ANY orders with this user_id
SELECT 
  o.*,
  t.temp_full_name as talent_name
FROM orders o
LEFT JOIN talent_profiles t ON o.talent_id = t.id
WHERE o.user_id = (SELECT id FROM public.users WHERE email = 'trainleader21@gmail.com')
ORDER BY o.created_at DESC;

-- 3. Search by payment transaction ID if we know it
-- Check Fortis dashboard for Mark's transaction ID and look for it
SELECT 
  o.*,
  u.email as user_email,
  t.temp_full_name as talent_name
FROM orders o
LEFT JOIN public.users u ON o.user_id = u.id
LEFT JOIN talent_profiles t ON o.talent_id = t.id
WHERE o.payment_transaction_id LIKE '%mark%'
   OR o.created_at > '2025-11-27'  -- Around when he tried
ORDER BY o.created_at DESC;

-- 4. Check notifications sent to Mark
SELECT 
  n.*
FROM notifications n
WHERE n.user_id = (SELECT id FROM public.users WHERE email = 'trainleader21@gmail.com')
ORDER BY n.created_at DESC;

-- 5. Get Gerald Morgan's talent_id for reference
SELECT 
  id as gerald_talent_id,
  temp_full_name,
  pricing,
  user_id
FROM talent_profiles
WHERE temp_full_name ILIKE '%gerald%morgan%';


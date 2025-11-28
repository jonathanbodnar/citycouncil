-- Check for Mark Walker's order for Gerald Morgan
-- Email: trainleader21@gmail.com

-- 1. Find user ID
SELECT 
  id,
  email,
  phone,
  full_name
FROM public.users
WHERE email = 'trainleader21@gmail.com';

-- 2. Find Gerald Morgan's talent ID
SELECT 
  id,
  temp_full_name,
  user_id
FROM talent_profiles
WHERE LOWER(temp_full_name) LIKE '%gerald%morgan%'
   OR LOWER(temp_full_name) LIKE '%morgan%gerald%';

-- 3. Check for orders matching this combination
SELECT 
  o.id,
  o.user_id,
  o.talent_id,
  o.status,
  o.amount / 100.0 as amount_dollars,
  o.payment_transaction_id,
  o.request_details,
  o.created_at,
  u.email as user_email,
  u.phone as user_phone,
  t.temp_full_name as talent_name
FROM orders o
LEFT JOIN public.users u ON o.user_id = u.id
LEFT JOIN talent_profiles t ON o.talent_id = t.id
WHERE u.email = 'trainleader21@gmail.com'
   OR o.user_id IN (SELECT id FROM public.users WHERE email = 'trainleader21@gmail.com')
ORDER BY o.created_at DESC;

-- 4. Check all orders in last 2 hours
SELECT 
  o.id,
  o.user_id,
  o.talent_id,
  o.status,
  o.amount / 100.0 as amount_dollars,
  o.payment_transaction_id,
  o.created_at,
  u.email,
  u.phone,
  t.temp_full_name as talent_name
FROM orders o
LEFT JOIN public.users u ON o.user_id = u.id
LEFT JOIN talent_profiles t ON o.talent_id = t.id
WHERE o.created_at > NOW() - INTERVAL '2 hours'
ORDER BY o.created_at DESC;


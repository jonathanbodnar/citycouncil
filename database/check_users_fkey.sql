-- Check the users table foreign key constraint

-- 1. What is this self-referencing foreign key?
SELECT 
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'users'
AND tc.constraint_type = 'FOREIGN KEY';

-- 2. Show users table structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;

-- 3. Check existing demo orders - what user_id do they use?
SELECT 
  o.id,
  o.user_id,
  u.email,
  u.full_name,
  u.user_type,
  tp.full_name as talent_name,
  o.order_type,
  o.created_at
FROM orders o
LEFT JOIN users u ON u.id = o.user_id
LEFT JOIN talent_profiles tp ON tp.id = o.talent_id
WHERE o.order_type = 'demo'
ORDER BY o.created_at DESC
LIMIT 10;

-- 4. Can we use an existing 'user' type user for demo orders?
SELECT 
  'Existing User-type Users' as info,
  id,
  email,
  full_name,
  user_type,
  created_at
FROM users
WHERE user_type = 'user'
ORDER BY created_at ASC
LIMIT 5;

-- 5. Check if there's a demo customer user that already exists
SELECT 
  'Existing Demo Customers' as info,
  id,
  email,
  full_name,
  user_type
FROM users
WHERE email LIKE 'demo_customer_%@shoutout.us'
OR full_name = 'Michael Thompson'
ORDER BY created_at DESC;


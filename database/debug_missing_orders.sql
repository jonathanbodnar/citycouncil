-- Debug script to find missing orders issue
-- Run this in Supabase SQL Editor to diagnose the problem

-- 1. Check total orders in database
SELECT 
  COUNT(*) as total_orders,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(DISTINCT talent_id) as unique_talents
FROM orders;

-- 2. Check orders per user (find the user with 4 orders)
SELECT 
  user_id,
  users.email,
  users.full_name,
  COUNT(*) as order_count,
  array_agg(orders.id ORDER BY orders.created_at) as order_ids,
  array_agg(orders.created_at ORDER BY orders.created_at) as order_times
FROM orders
LEFT JOIN users ON orders.user_id = users.id
GROUP BY user_id, users.email, users.full_name
HAVING COUNT(*) > 1
ORDER BY order_count DESC;

-- 3. Check if there are duplicate payment_transaction_ids (might indicate order duplication prevention)
SELECT 
  payment_transaction_id,
  COUNT(*) as times_used
FROM orders
WHERE payment_transaction_id IS NOT NULL
GROUP BY payment_transaction_id
HAVING COUNT(*) > 1;

-- 4. Check RLS policies on orders table
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'orders';

-- 5. For a specific user (replace with actual user email), check all their orders
-- REPLACE 'user@example.com' with the actual user's email
SELECT 
  o.id,
  o.created_at,
  o.status,
  o.amount,
  o.payment_transaction_id,
  u.email as user_email,
  tp.username as talent_username,
  tu.full_name as talent_name
FROM orders o
LEFT JOIN users u ON o.user_id = u.id
LEFT JOIN talent_profiles tp ON o.talent_id = tp.id
LEFT JOIN users tu ON tp.user_id = tu.id
WHERE u.email = 'user@example.com'  -- REPLACE THIS
ORDER BY o.created_at DESC;

-- 6. Check for any orders with NULL user_id (orphaned orders)
SELECT 
  COUNT(*) as orphaned_orders
FROM orders
WHERE user_id IS NULL;

-- 7. Check recent orders (last 24 hours)
SELECT 
  o.id,
  o.created_at,
  u.email as user_email,
  u.full_name as user_name,
  tp.username as talent_username,
  tu.full_name as talent_name,
  o.amount,
  o.status
FROM orders o
LEFT JOIN users u ON o.user_id = u.id
LEFT JOIN talent_profiles tp ON o.talent_id = tp.id
LEFT JOIN users tu ON tp.user_id = tu.id
WHERE o.created_at > NOW() - INTERVAL '24 hours'
ORDER BY o.created_at DESC;


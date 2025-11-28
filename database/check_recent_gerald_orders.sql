-- Check all recent orders for Gerald Morgan to see if any match Mark's timeframe

-- 1. Get Gerald Morgan's talent_id
SELECT id, temp_full_name, pricing 
FROM talent_profiles 
WHERE temp_full_name ILIKE '%gerald%morgan%';

-- 2. Get ALL orders for Gerald Morgan
SELECT 
  o.id,
  o.user_id,
  o.amount / 100.0 as amount_dollars,
  o.status,
  o.payment_transaction_id,
  o.created_at,
  u.email,
  u.phone,
  u.full_name
FROM orders o
LEFT JOIN public.users u ON o.user_id = u.id
WHERE o.talent_id = (
  SELECT id FROM talent_profiles WHERE temp_full_name ILIKE '%gerald%morgan%'
)
ORDER BY o.created_at DESC;

-- 3. Check orders created in the last 24 hours (any talent)
SELECT 
  o.id,
  o.user_id,
  o.talent_id,
  o.amount / 100.0 as amount_dollars,
  o.status,
  o.payment_transaction_id,
  o.created_at,
  u.email,
  u.full_name,
  t.temp_full_name as talent_name
FROM orders o
LEFT JOIN public.users u ON o.user_id = u.id
LEFT JOIN talent_profiles t ON o.talent_id = t.id
WHERE o.created_at > NOW() - INTERVAL '24 hours'
ORDER BY o.created_at DESC;


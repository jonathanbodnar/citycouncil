-- Check for recent orders in the last 24 hours to see if payment went through
-- but order didn't get created

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
  u.full_name,
  t.temp_full_name as talent_name
FROM orders o
LEFT JOIN public.users u ON o.user_id = u.id
LEFT JOIN talent_profiles t ON o.talent_id = t.id
WHERE o.created_at > NOW() - INTERVAL '24 hours'
ORDER BY o.created_at DESC
LIMIT 20;


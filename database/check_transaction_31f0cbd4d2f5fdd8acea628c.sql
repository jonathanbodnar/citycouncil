-- Check if transaction ID 31f0cbd4d2f5fdd8acea628c exists in any order

SELECT 
  'Checking for transaction ID' as check_type,
  o.id,
  o.user_id,
  o.talent_id,
  o.payment_transaction_id,
  o.amount / 100.0 as amount_dollars,
  o.status,
  o.created_at,
  u.email,
  t.temp_full_name as talent_name
FROM orders o
LEFT JOIN public.users u ON o.user_id = u.id
LEFT JOIN talent_profiles t ON o.talent_id = t.id
WHERE o.payment_transaction_id = '31f0cbd4d2f5fdd8acea628c';

-- If no results, transaction was charged but order was never created
SELECT 
  CASE 
    WHEN NOT EXISTS (
      SELECT 1 FROM orders WHERE payment_transaction_id = '31f0cbd4d2f5fdd8acea628c'
    ) THEN '❌ Transaction NOT found in any order - needs manual creation'
    ELSE '✅ Transaction found in order'
  END as result;


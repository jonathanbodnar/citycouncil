-- Delete the accidentally created test order for JP Sears

-- First, find the test order
SELECT 
  'TEST ORDER TO DELETE' as info,
  o.id,
  o.payment_transaction_id,
  o.status,
  o.created_at,
  t.temp_full_name as talent_name,
  u.email as customer_email
FROM orders o
JOIN talent_profiles t ON o.talent_id = t.id
JOIN users u ON o.user_id = u.id
WHERE o.payment_transaction_id LIKE 'TEST_UPLOAD_%'
ORDER BY o.created_at DESC
LIMIT 5;

-- Delete notifications for these test orders
DELETE FROM notifications
WHERE order_id IN (
  SELECT id FROM orders WHERE payment_transaction_id LIKE 'TEST_UPLOAD_%'
);

-- Delete payouts for these test orders
DELETE FROM payouts
WHERE order_id IN (
  SELECT id FROM orders WHERE payment_transaction_id LIKE 'TEST_UPLOAD_%'
);

-- Delete the test orders
DELETE FROM orders
WHERE payment_transaction_id LIKE 'TEST_UPLOAD_%';

-- Confirm deletion
SELECT 
  '✅ Test orders deleted' as result,
  COUNT(*) as remaining_test_orders
FROM orders
WHERE payment_transaction_id LIKE 'TEST_UPLOAD_%';


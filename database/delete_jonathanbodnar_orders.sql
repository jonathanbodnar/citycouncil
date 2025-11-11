-- Delete all orders for jonathanbodnar talent profile
-- This will cascade delete related notifications and other records

-- Step 1: Find jonathanbodnar's talent profile ID
SELECT 
  tp.id as talent_id,
  tp.username,
  u.full_name,
  COUNT(o.id) as order_count
FROM talent_profiles tp
LEFT JOIN users u ON tp.user_id = u.id
LEFT JOIN orders o ON o.talent_id = tp.id
WHERE tp.username = 'jonathanbodnar'
GROUP BY tp.id, tp.username, u.full_name;

-- Step 2: Show orders that will be deleted
SELECT 
  o.id,
  o.created_at,
  o.amount,
  o.status,
  o.order_type,
  u.email as customer_email,
  u.full_name as customer_name
FROM orders o
JOIN users u ON o.user_id = u.id
WHERE o.talent_id IN (
  SELECT id FROM talent_profiles WHERE username = 'jonathanbodnar'
)
ORDER BY o.created_at DESC;

-- Step 3: Delete reviews for these orders (if any)
DELETE FROM reviews
WHERE order_id IN (
  SELECT o.id 
  FROM orders o
  WHERE o.talent_id IN (
    SELECT id FROM talent_profiles WHERE username = 'jonathanbodnar'
  )
);

-- Step 4: Delete notifications related to these orders
DELETE FROM notifications
WHERE order_id IN (
  SELECT o.id 
  FROM orders o
  WHERE o.talent_id IN (
    SELECT id FROM talent_profiles WHERE username = 'jonathanbodnar'
  )
);

-- Step 5: Delete short links for these orders
DELETE FROM short_links
WHERE order_id IN (
  SELECT o.id 
  FROM orders o
  WHERE o.talent_id IN (
    SELECT id FROM talent_profiles WHERE username = 'jonathanbodnar'
  )
);

-- Step 6: Delete fulfillment auth tokens for these orders
DELETE FROM fulfillment_auth_tokens
WHERE order_id IN (
  SELECT o.id 
  FROM orders o
  WHERE o.talent_id IN (
    SELECT id FROM talent_profiles WHERE username = 'jonathanbodnar'
  )
);

-- Step 7: Delete magic auth tokens for these orders
DELETE FROM magic_auth_tokens
WHERE order_id IN (
  SELECT o.id 
  FROM orders o
  WHERE o.talent_id IN (
    SELECT id FROM talent_profiles WHERE username = 'jonathanbodnar'
  )
);

-- Step 8: Delete payouts for these orders
DELETE FROM payouts
WHERE order_id IN (
  SELECT o.id 
  FROM orders o
  WHERE o.talent_id IN (
    SELECT id FROM talent_profiles WHERE username = 'jonathanbodnar'
  )
);

-- Step 9: Delete payout errors for these orders
DELETE FROM payout_errors
WHERE order_id IN (
  SELECT o.id 
  FROM orders o
  WHERE o.talent_id IN (
    SELECT id FROM talent_profiles WHERE username = 'jonathanbodnar'
  )
);

-- Step 10: Finally, delete all orders
DELETE FROM orders
WHERE talent_id IN (
  SELECT id FROM talent_profiles WHERE username = 'jonathanbodnar'
);

-- Verify deletion
SELECT 
  tp.username,
  COUNT(o.id) as remaining_orders
FROM talent_profiles tp
LEFT JOIN orders o ON o.talent_id = tp.id
WHERE tp.username = 'jonathanbodnar'
GROUP BY tp.username;

-- Show success message
SELECT '✅ All orders for jonathanbodnar have been deleted' as result;


-- Fix old orders that were stored in dollars instead of cents
-- Orders with amount < 10000 cents ($100) are likely stored in dollars
-- Multiply those by 100 to convert to cents

-- First, check how many orders need updating
-- SELECT id, amount, amount * 100 as new_amount, created_at 
-- FROM orders 
-- WHERE amount < 10000 
-- ORDER BY created_at DESC;

-- Update old orders: convert dollars to cents
UPDATE orders 
SET 
  amount = amount * 100,
  admin_fee = admin_fee * 100,
  charity_amount = COALESCE(charity_amount * 100, 0)
WHERE amount < 10000  -- Only update orders where amount < $100 (likely in dollars)
  AND created_at < '2025-11-07 19:00:00'::timestamptz;  -- Only update orders before the cents fix

-- Display results
SELECT 
  id, 
  amount / 100.0 as amount_dollars, 
  admin_fee / 100.0 as admin_fee_dollars,
  created_at 
FROM orders 
ORDER BY created_at DESC 
LIMIT 10;


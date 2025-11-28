-- Check the data type of the amount column in orders table
SELECT 
    column_name,
    data_type,
    numeric_precision,
    numeric_scale
FROM information_schema.columns
WHERE table_name = 'orders'
  AND column_name IN ('amount', 'original_amount', 'discount_amount', 'admin_fee', 'charity_amount');

-- Check a few recent orders to see the pattern
SELECT 
  id,
  amount,
  amount / 100.0 as display_amount,
  original_amount,
  created_at,
  status
FROM orders
ORDER BY created_at DESC
LIMIT 10;


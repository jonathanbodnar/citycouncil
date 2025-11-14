-- Check orders table schema to see what columns exist
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'orders'
ORDER BY ordinal_position;

-- Check sample order data
SELECT 
    id,
    amount,
    admin_fee,
    status,
    created_at
FROM orders
LIMIT 5;


-- Check for constraints that might prevent multiple orders from same user

-- 1. Check table structure and constraints
SELECT 
  c.conname as constraint_name,
  c.contype as constraint_type,
  pg_get_constraintdef(c.oid) as constraint_definition
FROM pg_constraint c
JOIN pg_namespace n ON n.oid = c.connamespace
JOIN pg_class cl ON cl.oid = c.conrelid
WHERE cl.relname = 'orders'
  AND n.nspname = 'public';

-- 2. Check indexes on orders table
SELECT
  i.relname as index_name,
  am.amname as index_type,
  idx.indisunique as is_unique,
  idx.indisprimary as is_primary,
  ARRAY(
    SELECT pg_get_indexdef(idx.indexrelid, k + 1, true)
    FROM generate_subscripts(idx.indkey, 1) as k
    ORDER BY k
  ) as index_columns
FROM pg_index idx
JOIN pg_class i ON i.oid = idx.indexrelid
JOIN pg_class t ON t.oid = idx.indrelid
JOIN pg_am am ON i.relam = am.oid
WHERE t.relname = 'orders'
  AND t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY i.relname;

-- 3. Check for triggers that might affect inserts
SELECT 
  tgname as trigger_name,
  tgtype as trigger_type,
  tgenabled as is_enabled,
  pg_get_triggerdef(oid) as trigger_definition
FROM pg_trigger
WHERE tgrelid = 'public.orders'::regclass
  AND tgisinternal = false;

-- 4. Check if there's a UNIQUE constraint on (user_id, talent_id) or similar
SELECT
  conname,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'public.orders'::regclass
  AND contype = 'u'  -- unique constraints
ORDER BY conname;

-- 5. Test: Can we insert multiple orders for same user?
-- DON'T RUN THIS YET - just check what constraints would be violated
-- This will show constraint violation errors if any exist:
/*
INSERT INTO orders (user_id, talent_id, request_details, amount, admin_fee, status, payment_transaction_id, fulfillment_deadline)
VALUES 
  ('test-user-id', 'talent-1-id', 'Test order 1', 100, 15, 'pending', 'test-txn-1', NOW() + INTERVAL '48 hours'),
  ('test-user-id', 'talent-2-id', 'Test order 2', 100, 15, 'pending', 'test-txn-2', NOW() + INTERVAL '48 hours');
*/


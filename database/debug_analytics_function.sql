-- Debug: Check what data exists in each table

-- Check orders date range
SELECT 'orders' as table_name, 
       MIN(created_at) as earliest, 
       MAX(created_at) as latest,
       COUNT(*) as total
FROM orders
WHERE is_demo_order IS NOT TRUE;

-- Check users date range  
SELECT 'users' as table_name,
       MIN(created_at) as earliest,
       MAX(created_at) as latest,
       COUNT(*) as total
FROM users
WHERE user_type = 'user';

-- Check beta_signups date range
SELECT 'beta_signups' as table_name,
       MIN(subscribed_at) as earliest,
       MAX(subscribed_at) as latest,
       COUNT(*) as total
FROM beta_signups;

-- Test the timestamp conversion logic
SELECT 
  '2025-12-01' as input_date,
  ('2025-12-01 00:00:00')::timestamp AT TIME ZONE 'America/Chicago' as start_ts,
  ('2025-12-14 23:59:59.999')::timestamp AT TIME ZONE 'America/Chicago' as end_ts;

-- Check if orders fall within the range
SELECT COUNT(*) as orders_in_range
FROM orders o
WHERE o.created_at >= (('2025-12-01' || ' 00:00:00')::timestamp AT TIME ZONE 'America/Chicago')
  AND o.created_at <= (('2025-12-14' || ' 23:59:59.999')::timestamp AT TIME ZONE 'America/Chicago')
  AND o.is_demo_order IS NOT TRUE;

-- Check raw created_at values for recent orders
SELECT id, created_at, 
       created_at AT TIME ZONE 'America/Chicago' as cst_time,
       to_char(created_at AT TIME ZONE 'America/Chicago', 'YYYY-MM-DD') as cst_date
FROM orders 
WHERE is_demo_order IS NOT TRUE
ORDER BY created_at DESC 
LIMIT 10;



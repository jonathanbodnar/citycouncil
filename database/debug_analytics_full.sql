-- STEP 1: Check raw data exists
SELECT 'orders' as tbl, COUNT(*) as cnt FROM orders WHERE is_demo_order IS NOT TRUE;
SELECT 'users' as tbl, COUNT(*) as cnt FROM users WHERE user_type = 'user';
SELECT 'beta_signups' as tbl, COUNT(*) as cnt FROM beta_signups;

-- STEP 2: Check date ranges of actual data
SELECT 'orders' as tbl, MIN(created_at) as min_date, MAX(created_at) as max_date FROM orders WHERE is_demo_order IS NOT TRUE;
SELECT 'users' as tbl, MIN(created_at) as min_date, MAX(created_at) as max_date FROM users WHERE user_type = 'user';
SELECT 'beta_signups' as tbl, MIN(subscribed_at) as min_date, MAX(subscribed_at) as max_date FROM beta_signups;

-- STEP 3: Check what the function returns with NO date filter
-- First, let's create a simpler version that just returns everything
SELECT 
  'order'::text as record_type,
  to_char(timezone('America/Chicago', o.created_at), 'YYYY-MM-DD') as cst_date,
  o.promo_source::text,
  o.did_holiday_popup
FROM orders o
WHERE o.is_demo_order IS NOT TRUE
LIMIT 10;

-- STEP 4: Test timezone conversion
SELECT 
  NOW() as utc_now,
  timezone('America/Chicago', NOW()) as cst_now,
  timezone('America/Chicago', '2025-12-14 00:00:00'::timestamp) as dec14_start_utc,
  timezone('America/Chicago', '2025-12-14 23:59:59'::timestamp) as dec14_end_utc;

-- STEP 5: Check if the issue is with subscribed_at column type
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'beta_signups' AND column_name = 'subscribed_at';

SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'orders' AND column_name = 'created_at';

SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'created_at';


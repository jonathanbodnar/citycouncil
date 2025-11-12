-- Test the exact query that AdminPayoutsManagement uses

-- 1. Check if tables exist
SELECT 
  '📋 Table Check' AS test,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payouts') AS payouts_exists,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payout_batches') AS payout_batches_exists;

-- 2. Check foreign key constraints
SELECT 
  '🔗 Foreign Key Check' AS test,
  constraint_name,
  table_name,
  constraint_type
FROM information_schema.table_constraints
WHERE table_name IN ('payouts', 'payout_batches')
  AND constraint_type = 'FOREIGN KEY';

-- 3. Test the batch query (similar to what admin page does)
SELECT 
  '📦 Batch Query Test' AS test,
  pb.*,
  tp.username,
  tp.temp_full_name
FROM payout_batches pb
LEFT JOIN talent_profiles tp ON tp.id = pb.talent_id
ORDER BY pb.week_start_date DESC
LIMIT 5;

-- 4. Test the itemized payout query for the first batch
WITH first_batch AS (
  SELECT talent_id, week_start_date
  FROM payout_batches
  ORDER BY week_start_date DESC
  LIMIT 1
)
SELECT 
  '📝 Itemized Payout Query Test' AS test,
  p.*,
  o.request_details,
  o.recipient_name,
  o.status as order_status
FROM payouts p
LEFT JOIN orders o ON o.id = p.order_id
WHERE p.talent_id = (SELECT talent_id FROM first_batch)
  AND p.week_start_date = (SELECT week_start_date FROM first_batch)
ORDER BY p.created_at DESC;

-- 5. Count totals
SELECT 
  '📊 Totals' AS test,
  (SELECT COUNT(*) FROM payout_batches) AS total_batches,
  (SELECT COUNT(*) FROM payouts) AS total_payouts,
  (SELECT COUNT(*) FROM payouts WHERE week_start_date IS NOT NULL) AS payouts_with_week;


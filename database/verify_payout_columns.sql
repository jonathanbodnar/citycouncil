-- Verify the payout tables have the correct columns

SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name IN ('payouts', 'payout_batches')
  AND table_schema = 'public'
ORDER BY table_name, ordinal_position;


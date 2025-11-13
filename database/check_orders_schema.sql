-- Check orders table schema for due date related columns

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'orders'
  AND table_schema = 'public'
ORDER BY ordinal_position;

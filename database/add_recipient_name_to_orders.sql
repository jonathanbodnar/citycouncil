-- Add recipient_name column to orders table
-- This stores "Who is it for?" from the order form

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS recipient_name TEXT;

-- Add a comment to document the field
COMMENT ON COLUMN orders.recipient_name IS 'Name of the person the ShoutOut is for (Who is it for? field)';

-- Verify the column was added
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'orders' 
  AND column_name = 'recipient_name';


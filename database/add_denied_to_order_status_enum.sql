-- Add 'denied' to order_status enum

-- First check current values
SELECT 'Current order_status enum values:' as info;
SELECT enumlabel as current_values
FROM pg_enum e
JOIN pg_type t ON t.oid = e.enumtypid
WHERE t.typname = 'order_status'
ORDER BY e.enumsortorder;

-- Add 'denied' if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'order_status' 
    AND e.enumlabel = 'denied'
  ) THEN
    ALTER TYPE order_status ADD VALUE 'denied';
    RAISE NOTICE '✅ Added "denied" to order_status enum';
  ELSE
    RAISE NOTICE 'ℹ️ "denied" already exists in order_status enum';
  END IF;
END $$;

-- Verify it was added
SELECT 'Updated order_status enum values:' as info;
SELECT enumlabel as updated_values
FROM pg_enum e
JOIN pg_type t ON t.oid = e.enumtypid
WHERE t.typname = 'order_status'
ORDER BY e.enumsortorder;


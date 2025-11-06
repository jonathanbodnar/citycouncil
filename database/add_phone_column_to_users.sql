-- Add phone column to users table
-- This is required for the UPSERT during talent onboarding

-- =============================================================================
-- Add phone column if it doesn't exist
-- =============================================================================

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS phone text;

-- =============================================================================
-- Verify the column was added
-- =============================================================================

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'users' 
  AND table_schema = 'public'
  AND column_name = 'phone';

-- Expected: Should show phone column with type 'text'

-- =============================================================================
-- Show all columns in users table
-- =============================================================================

SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'users' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- =============================================================================
-- SUMMARY
-- =============================================================================

SELECT 
  'Phone column added' as status,
  'Registration should now work!' as message;


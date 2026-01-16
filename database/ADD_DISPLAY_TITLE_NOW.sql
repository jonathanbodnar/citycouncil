-- Add display_title column and refresh schema cache
-- RUN THIS IN SUPABASE SQL EDITOR

BEGIN;

-- Add the column if it doesn't exist
ALTER TABLE talent_profiles
ADD COLUMN IF NOT EXISTS display_title TEXT;

-- Commit the change
COMMIT;

-- Refresh PostgREST schema cache (CRITICAL!)
NOTIFY pgrst, 'reload schema';

-- Wait a moment for cache refresh
SELECT pg_sleep(1);

-- Verify the column exists
SELECT 
  '✅ Column Status' as check_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'talent_profiles'
  AND column_name = 'display_title';

-- Show sample of talent with their current title (should be NULL for now)
SELECT 
  '📋 Current Talent Titles' as section,
  username,
  temp_full_name as name,
  display_title
FROM talent_profiles
WHERE is_active = true
ORDER BY username
LIMIT 10;

SELECT '✅ SUCCESS! Column added and schema cache refreshed!' as status;
SELECT 'Now you can edit talent in Admin > Talent > Edit and add custom titles' as next_step;
SELECT 'The titles will appear on homepage banner cards immediately' as note;

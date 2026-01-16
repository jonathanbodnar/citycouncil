-- Fix: Add featured_shoutout_types column and refresh schema cache

-- Check if column exists, add if needed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'talent_profiles' 
    AND column_name = 'featured_shoutout_types'
  ) THEN
    -- Add the column
    ALTER TABLE talent_profiles 
    ADD COLUMN featured_shoutout_types TEXT[];
    
    RAISE NOTICE '✅ Added featured_shoutout_types column to talent_profiles';
  ELSE
    RAISE NOTICE '✅ Column already exists';
  END IF;
END $$;

-- Refresh PostgREST schema cache so the API recognizes the new column
NOTIFY pgrst, 'reload schema';

-- Verify the column exists
SELECT 
  'Column verification' as check_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'talent_profiles'
  AND column_name = 'featured_shoutout_types';

-- Show a sample of current data
SELECT 
  'Sample data' as section,
  username,
  featured_shoutout_types,
  categories
FROM talent_profiles
WHERE is_active = true
LIMIT 5;

SELECT '✅ Column added and schema cache refreshed!' as status;
SELECT 'You can now update featured_shoutout_types in the admin panel' as next_step;

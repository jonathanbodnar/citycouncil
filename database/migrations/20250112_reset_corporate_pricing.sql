-- Reset Corporate Pricing for All Talent
-- This migration clears all existing corporate pricing and sets the stage for the new corporate event feature

-- Show current state BEFORE
SELECT 
  'BEFORE UPDATE' as status,
  COUNT(*) as total_talent,
  COUNT(CASE WHEN corporate_pricing IS NOT NULL THEN 1 END) as with_corporate_pricing,
  COUNT(CASE WHEN allow_corporate_pricing = TRUE THEN 1 END) as with_allow_flag
FROM talent_profiles;

-- First, drop the NOT NULL constraint if it exists (allows NULL values)
ALTER TABLE talent_profiles 
  ALTER COLUMN corporate_pricing DROP NOT NULL;

-- Temporarily disable RLS to ensure UPDATE works
ALTER TABLE talent_profiles DISABLE ROW LEVEL SECURITY;

-- Clear all corporate pricing values
UPDATE talent_profiles 
SET 
  corporate_pricing = NULL,
  allow_corporate_pricing = FALSE,
  updated_at = NOW();

-- Re-enable RLS
ALTER TABLE talent_profiles ENABLE ROW LEVEL SECURITY;

-- Add comment to corporate_pricing column to clarify new usage
COMMENT ON COLUMN talent_profiles.corporate_pricing IS 'Corporate event ShoutOut pricing - set by talent. NULL means not offering corporate events.';
COMMENT ON COLUMN talent_profiles.allow_corporate_pricing IS 'Legacy field - kept for backwards compatibility but not used in new corporate event flow.';

-- Verify the update AFTER
SELECT 
  'AFTER UPDATE' as status,
  COUNT(*) as total_talent,
  COUNT(CASE WHEN corporate_pricing IS NOT NULL THEN 1 END) as with_corporate_pricing,
  COUNT(CASE WHEN allow_corporate_pricing = TRUE THEN 1 END) as with_allow_flag
FROM talent_profiles;

-- Show which talent (if any) still have corporate pricing
SELECT 
  id,
  temp_full_name,
  corporate_pricing,
  allow_corporate_pricing,
  pricing as regular_pricing
FROM talent_profiles
WHERE corporate_pricing IS NOT NULL OR allow_corporate_pricing = TRUE
LIMIT 10;


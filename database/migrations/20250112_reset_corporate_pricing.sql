-- Reset Corporate Pricing for All Talent
-- This migration clears all existing corporate pricing and sets the stage for the new corporate event feature

-- Clear all corporate pricing values
UPDATE talent_profiles 
SET 
  corporate_pricing = NULL,
  allow_corporate_pricing = FALSE,
  updated_at = NOW()
WHERE corporate_pricing IS NOT NULL OR allow_corporate_pricing = TRUE;

-- Add comment to corporate_pricing column to clarify new usage
COMMENT ON COLUMN talent_profiles.corporate_pricing IS 'Corporate event ShoutOut pricing - set by talent. NULL means not offering corporate events.';
COMMENT ON COLUMN talent_profiles.allow_corporate_pricing IS 'Legacy field - kept for backwards compatibility but not used in new corporate event flow.';

-- Verify the update
SELECT 
  COUNT(*) as total_talent,
  COUNT(CASE WHEN corporate_pricing IS NOT NULL THEN 1 END) as with_corporate_pricing
FROM talent_profiles;


-- Add promotion tracking field to talent profiles

-- Add promotion participation field
ALTER TABLE talent_profiles 
ADD COLUMN IF NOT EXISTS is_participating_in_promotion BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS promotion_claimed_at TIMESTAMP WITH TIME ZONE;

-- Add comments
COMMENT ON COLUMN talent_profiles.is_participating_in_promotion IS 'Whether talent has claimed the ShoutOut Promotion Package';
COMMENT ON COLUMN talent_profiles.promotion_claimed_at IS 'When the talent claimed the promotion package';

-- Create index
CREATE INDEX IF NOT EXISTS idx_talent_profiles_promotion 
ON talent_profiles(is_participating_in_promotion);

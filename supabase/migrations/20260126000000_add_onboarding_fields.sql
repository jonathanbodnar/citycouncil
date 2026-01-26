-- Migration: Add onboarding fields for talent self-registration
-- Description: Adds instagram_followers and selected_shoutout_types columns to talent_profiles

-- Add instagram_followers column (for pricing suggestions based on follower count)
ALTER TABLE talent_profiles
ADD COLUMN IF NOT EXISTS instagram_followers INTEGER;

-- Add selected_shoutout_types column (stores up to 3 shoutout types selected during onboarding)
ALTER TABLE talent_profiles
ADD COLUMN IF NOT EXISTS selected_shoutout_types TEXT[] DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN talent_profiles.instagram_followers IS 'Instagram follower count used for pricing suggestions during onboarding';
COMMENT ON COLUMN talent_profiles.selected_shoutout_types IS 'Array of shoutout types selected during onboarding (max 3): birthday, pep-talk, roast, advice, corporate';

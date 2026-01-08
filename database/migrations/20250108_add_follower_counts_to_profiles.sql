-- Add follower_counts JSON column to talent_profiles
-- This stores follower counts for social accounts that come from talent_profiles handles
-- Format: {"instagram": 500000, "tiktok": 100000, ...}
ALTER TABLE talent_profiles
ADD COLUMN IF NOT EXISTS follower_counts JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN talent_profiles.follower_counts IS 'JSON object storing follower counts per platform: {"instagram": 500000, "tiktok": 100000}';


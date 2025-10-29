-- Add Instagram tracking fields to talent_profiles
-- Run this in Supabase SQL Editor

ALTER TABLE talent_profiles 
ADD COLUMN IF NOT EXISTS instagram_username VARCHAR(255),
ADD COLUMN IF NOT EXISTS instagram_user_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS instagram_access_token TEXT,
ADD COLUMN IF NOT EXISTS instagram_token_expires_at TIMESTAMP WITH TIME ZONE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_talent_instagram ON talent_profiles(instagram_username);
CREATE INDEX IF NOT EXISTS idx_talent_instagram_user_id ON talent_profiles(instagram_user_id);

-- Add comment for documentation
COMMENT ON COLUMN talent_profiles.instagram_username IS 'Instagram username for promotion tracking';
COMMENT ON COLUMN talent_profiles.instagram_user_id IS 'Instagram user ID from Meta API';
COMMENT ON COLUMN talent_profiles.instagram_access_token IS 'OAuth access token for Instagram API (encrypted)';
COMMENT ON COLUMN talent_profiles.instagram_token_expires_at IS 'When the Instagram access token expires (typically 60 days)';


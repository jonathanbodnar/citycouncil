-- Add follower_count column to social_accounts table
ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS follower_count INTEGER;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_social_accounts_follower_count ON social_accounts(follower_count) WHERE follower_count IS NOT NULL;

COMMENT ON COLUMN social_accounts.follower_count IS 'Cached follower count for this social account, updated periodically via scraping';


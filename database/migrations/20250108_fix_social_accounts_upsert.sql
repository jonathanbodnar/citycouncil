-- Add unique constraint on talent_id + platform for upsert to work
-- This allows us to upsert follower counts for social accounts

-- First, remove any duplicates (keep the one with the most data)
DELETE FROM social_accounts a
USING social_accounts b
WHERE a.talent_id = b.talent_id 
  AND a.platform = b.platform 
  AND a.id > b.id;

-- Add unique constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'social_accounts_talent_platform_unique'
  ) THEN
    ALTER TABLE social_accounts 
    ADD CONSTRAINT social_accounts_talent_platform_unique 
    UNIQUE (talent_id, platform);
  END IF;
END $$;


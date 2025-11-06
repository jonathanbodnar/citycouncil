-- Add full_name column to talent_profiles table
-- This is needed for the public onboarding flow

ALTER TABLE talent_profiles
ADD COLUMN IF NOT EXISTS full_name TEXT;

-- Add comment to column
COMMENT ON COLUMN talent_profiles.full_name IS 'Talent full legal name (e.g., "Jonathan Bodnar")';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_talent_profiles_full_name ON talent_profiles(full_name);

-- Update existing profiles that have a username but no full_name
-- This is a best-effort migration for existing data
UPDATE talent_profiles
SET full_name = INITCAP(REPLACE(username, '-', ' '))
WHERE full_name IS NULL
  AND username IS NOT NULL;


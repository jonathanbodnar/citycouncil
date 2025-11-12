-- Remove duplicate social media handle columns from talent_profiles
-- These fields already exist in the social_accounts table with full CRUD functionality

-- Drop the duplicate columns
ALTER TABLE public.talent_profiles
DROP COLUMN IF EXISTS instagram_handle,
DROP COLUMN IF EXISTS tiktok_handle,
DROP COLUMN IF EXISTS facebook_handle,
DROP COLUMN IF EXISTS twitter_handle;

-- Verify the columns were removed
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'talent_profiles' 
AND column_name IN ('instagram_handle', 'tiktok_handle', 'facebook_handle', 'twitter_handle')
ORDER BY column_name;

-- Should return 0 rows if successful


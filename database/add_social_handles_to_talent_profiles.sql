-- Add social media handle columns to talent_profiles table

ALTER TABLE public.talent_profiles
ADD COLUMN IF NOT EXISTS instagram_handle text,
ADD COLUMN IF NOT EXISTS tiktok_handle text,
ADD COLUMN IF NOT EXISTS facebook_handle text,
ADD COLUMN IF NOT EXISTS twitter_handle text;

-- Verify the columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'talent_profiles' 
AND column_name IN ('instagram_handle', 'tiktok_handle', 'facebook_handle', 'twitter_handle')
ORDER BY column_name;


-- Add promo video field to talent profiles

-- Add promo video URL field to talent_profiles table
ALTER TABLE talent_profiles 
ADD COLUMN IF NOT EXISTS promo_video_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN talent_profiles.promo_video_url IS 'URL of the talent promo/intro video for their profile';

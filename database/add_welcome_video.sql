-- Add welcome video field to talent profiles

-- Add welcome video URL field to talent_profiles table
ALTER TABLE talent_profiles 
ADD COLUMN IF NOT EXISTS welcome_video_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN talent_profiles.welcome_video_url IS 'URL of the talent welcome/intro video for their profile';

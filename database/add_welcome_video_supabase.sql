-- Add welcome video field to talent profiles (Supabase compatible)

-- Add welcome video URL field to talent_profiles table
ALTER TABLE talent_profiles 
ADD COLUMN welcome_video_url TEXT;

-- Add promo video field to talent profiles (Supabase compatible)

-- Add promo video URL field to talent_profiles table
ALTER TABLE talent_profiles 
ADD COLUMN promo_video_url TEXT;

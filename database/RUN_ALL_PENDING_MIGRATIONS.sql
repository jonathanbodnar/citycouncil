-- Run all pending migrations for bio features

-- 1. Add video_url column for featured video cards
ALTER TABLE bio_links ADD COLUMN IF NOT EXISTS video_url TEXT;
COMMENT ON COLUMN bio_links.video_url IS 'Direct URL to video file for featured video cards (mp4, webm, mov)';

-- 2. Add show_podcast_card column for podcast card visibility
ALTER TABLE bio_settings ADD COLUMN IF NOT EXISTS show_podcast_card BOOLEAN DEFAULT true;
UPDATE bio_settings 
SET show_podcast_card = true 
WHERE talent_id IN (
  SELECT id FROM talent_profiles WHERE podcast_rss_url IS NOT NULL
);
COMMENT ON COLUMN bio_settings.show_podcast_card IS 'Whether to display the podcast card on the bio page';

-- 3. Add snapchat_handle column for Snapchat social links
ALTER TABLE talent_profiles ADD COLUMN IF NOT EXISTS snapchat_handle TEXT;
COMMENT ON COLUMN talent_profiles.snapchat_handle IS 'Snapchat username (without @ symbol)';

-- Verify columns were added
SELECT 'video_url column' as migration, 
  EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name='bio_links' AND column_name='video_url'
  ) as added;

SELECT 'show_podcast_card column' as migration,
  EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name='bio_settings' AND column_name='show_podcast_card'
  ) as added;

SELECT 'snapchat_handle column' as migration,
  EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name='talent_profiles' AND column_name='snapchat_handle'
  ) as added;

-- Add show_podcast_card column to bio_settings table
ALTER TABLE bio_settings ADD COLUMN IF NOT EXISTS show_podcast_card BOOLEAN DEFAULT true;

-- Update existing records to show podcast card if they have a podcast RSS URL
UPDATE bio_settings 
SET show_podcast_card = true 
WHERE talent_id IN (
  SELECT id FROM talent_profiles WHERE podcast_rss_url IS NOT NULL
);

-- Add comment
COMMENT ON COLUMN bio_settings.show_podcast_card IS 'Whether to display the podcast card on the bio page';

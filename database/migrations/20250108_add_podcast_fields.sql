-- Add podcast fields to talent_profiles
ALTER TABLE talent_profiles
ADD COLUMN IF NOT EXISTS podcast_rss_url TEXT,
ADD COLUMN IF NOT EXISTS podcast_name TEXT;

-- Add show_podcast_card to bio_settings
ALTER TABLE bio_settings
ADD COLUMN IF NOT EXISTS show_podcast_card BOOLEAN DEFAULT true;


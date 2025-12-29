-- Add show_newsletter column to bio_settings
-- This controls whether the inline newsletter signup shows on the bio page

ALTER TABLE bio_settings ADD COLUMN IF NOT EXISTS show_newsletter BOOLEAN DEFAULT true;

COMMENT ON COLUMN bio_settings.show_newsletter IS 'Whether to show the inline newsletter signup field under the username on the bio page';


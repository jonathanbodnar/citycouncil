-- Add stream_card_order column to bio_settings
-- This stores the order of stream cards (rumble, youtube, podcast) on the bio page

ALTER TABLE bio_settings
ADD COLUMN IF NOT EXISTS stream_card_order TEXT[] DEFAULT ARRAY['rumble', 'youtube', 'podcast'];


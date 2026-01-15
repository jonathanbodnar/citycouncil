-- Add video_url column to bio_links table for featured video cards
ALTER TABLE bio_links ADD COLUMN IF NOT EXISTS video_url TEXT;

-- Add comment
COMMENT ON COLUMN bio_links.video_url IS 'Direct URL to video file for featured video cards (mp4, webm, mov)';

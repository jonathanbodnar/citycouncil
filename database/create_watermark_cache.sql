-- Create cache table for watermarked videos
-- This prevents re-uploading the same video to Cloudinary multiple times

CREATE TABLE IF NOT EXISTS watermarked_videos_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_video_url TEXT UNIQUE NOT NULL,
  cloudinary_url TEXT NOT NULL,
  cloudinary_public_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_watermarked_cache_original_url 
  ON watermarked_videos_cache(original_video_url);

-- RLS policies (allow service role to read/write)
ALTER TABLE watermarked_videos_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage watermark cache"
  ON watermarked_videos_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Comment for documentation
COMMENT ON TABLE watermarked_videos_cache IS 'Caches Cloudinary URLs for watermarked videos to avoid re-uploading the same video multiple times';


-- Create podcast_cache table for performance optimization
-- Similar to rumble_cache and youtube_cache

CREATE TABLE IF NOT EXISTS podcast_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_id UUID NOT NULL REFERENCES talent_profiles(id) ON DELETE CASCADE,
  podcast_rss_url TEXT NOT NULL,
  podcast_name TEXT,
  latest_episode_title TEXT,
  latest_episode_description TEXT,
  latest_episode_thumbnail TEXT,
  latest_episode_url TEXT,
  latest_episode_audio_url TEXT,
  latest_episode_duration TEXT,
  latest_episode_pub_date TEXT,
  listen_links JSONB, -- { spotify: "...", apple: "...", youtube: "...", google: "..." }
  last_checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(talent_id, podcast_rss_url)
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_podcast_cache_talent_id ON podcast_cache(talent_id);
CREATE INDEX IF NOT EXISTS idx_podcast_cache_last_checked ON podcast_cache(last_checked_at);

-- Enable RLS
ALTER TABLE podcast_cache ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read (for bio pages)
CREATE POLICY "Anyone can read podcast cache" ON podcast_cache
  FOR SELECT
  USING (true);

-- Allow authenticated users to insert/update their own cache
CREATE POLICY "Users can manage own podcast cache" ON podcast_cache
  FOR ALL
  USING (talent_id IN (SELECT id FROM talent_profiles WHERE user_id = auth.uid()))
  WITH CHECK (talent_id IN (SELECT id FROM talent_profiles WHERE user_id = auth.uid()));

-- Grant access
GRANT SELECT ON podcast_cache TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON podcast_cache TO authenticated;

-- Add comments
COMMENT ON TABLE podcast_cache IS 'Cache for podcast RSS feed data to improve bio page load times';
COMMENT ON COLUMN podcast_cache.listen_links IS 'Platform links from PodcastIndex API and RSS feed';
COMMENT ON COLUMN podcast_cache.last_checked_at IS 'Timestamp of last refresh - refresh if > 12 hours old';

-- Create podcast_cache table for performance optimization
-- Similar to rumble_cache and youtube_cache
-- Caches podcast data globally by RSS URL (same podcast = same data)

CREATE TABLE IF NOT EXISTS podcast_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  podcast_rss_url TEXT NOT NULL UNIQUE, -- Unique per RSS feed (global cache)
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_podcast_cache_rss_url ON podcast_cache(podcast_rss_url);
CREATE INDEX IF NOT EXISTS idx_podcast_cache_last_checked ON podcast_cache(last_checked_at);

-- Enable RLS
ALTER TABLE podcast_cache ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read (for bio pages)
CREATE POLICY "Anyone can read podcast cache" ON podcast_cache
  FOR SELECT
  USING (true);

-- Allow anyone to insert/update cache (anonymous users viewing bio pages trigger refresh)
CREATE POLICY "Anyone can manage podcast cache" ON podcast_cache
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Grant access
GRANT SELECT, INSERT, UPDATE ON podcast_cache TO anon, authenticated;

-- Add comments
COMMENT ON TABLE podcast_cache IS 'Cache for podcast RSS feed data - 12 hour TTL';
COMMENT ON COLUMN podcast_cache.listen_links IS 'Platform links from PodcastIndex API and RSS feed';
COMMENT ON COLUMN podcast_cache.last_checked_at IS 'Timestamp of last refresh - refresh if > 12 hours old';

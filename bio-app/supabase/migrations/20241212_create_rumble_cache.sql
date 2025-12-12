-- Create rumble_cache table to store scraped Rumble data
CREATE TABLE IF NOT EXISTS rumble_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_id UUID NOT NULL REFERENCES talent_profiles(id) ON DELETE CASCADE,
  rumble_handle TEXT NOT NULL,
  is_live BOOLEAN DEFAULT false,
  live_viewers INTEGER DEFAULT 0,
  latest_video_title TEXT,
  latest_video_thumbnail TEXT,
  latest_video_url TEXT,
  latest_video_views INTEGER DEFAULT 0,
  channel_url TEXT,
  last_checked_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(talent_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_rumble_cache_talent_id ON rumble_cache(talent_id);
CREATE INDEX IF NOT EXISTS idx_rumble_cache_is_live ON rumble_cache(is_live);

-- Enable RLS
ALTER TABLE rumble_cache ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for bio pages)
CREATE POLICY "Allow public read access to rumble_cache"
  ON rumble_cache FOR SELECT
  TO anon, authenticated
  USING (true);

-- Allow service role to manage cache
CREATE POLICY "Allow service role full access to rumble_cache"
  ON rumble_cache FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_rumble_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS rumble_cache_updated_at ON rumble_cache;
CREATE TRIGGER rumble_cache_updated_at
  BEFORE UPDATE ON rumble_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_rumble_cache_updated_at();

-- Enable pg_cron extension if not already enabled (for scheduled jobs)
-- Note: This needs to be run by a superuser/admin
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the Rumble check every 15 minutes
-- This will call the edge function to update the cache
-- SELECT cron.schedule(
--   'check-rumble-status',
--   '*/15 * * * *',
--   $$
--   SELECT net.http_post(
--     url := 'https://ckswlkwkzrliaborpfjw.supabase.co/functions/v1/check-rumble-status',
--     headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
--     body := '{}'::jsonb
--   );
--   $$
-- );


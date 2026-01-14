-- Create table for tracking bio page views
CREATE TABLE IF NOT EXISTS bio_page_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_id UUID NOT NULL REFERENCES talent_profiles(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  viewer_ip TEXT, -- Hashed for privacy
  viewer_country TEXT,
  viewer_city TEXT,
  user_agent TEXT,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  session_id TEXT -- Track unique sessions
);

-- Create indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_bio_page_views_talent_id ON bio_page_views(talent_id);
CREATE INDEX IF NOT EXISTS idx_bio_page_views_viewed_at ON bio_page_views(viewed_at);
CREATE INDEX IF NOT EXISTS idx_bio_page_views_session_id ON bio_page_views(session_id);

-- Enable RLS
ALTER TABLE bio_page_views ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert views (for tracking)
CREATE POLICY "Anyone can insert page views" ON bio_page_views
  FOR INSERT
  WITH CHECK (true);

-- Allow talents to read their own views
CREATE POLICY "Talents can read own page views" ON bio_page_views
  FOR SELECT
  USING (true); -- We'll filter in the application

-- Create a view for aggregated stats
CREATE OR REPLACE VIEW bio_page_view_stats AS
SELECT 
  talent_id,
  COUNT(*) as total_views,
  COUNT(DISTINCT session_id) as unique_views,
  COUNT(*) FILTER (WHERE viewed_at >= NOW() - INTERVAL '24 hours') as views_last_24h,
  COUNT(*) FILTER (WHERE viewed_at >= NOW() - INTERVAL '7 days') as views_last_7d,
  COUNT(*) FILTER (WHERE viewed_at >= NOW() - INTERVAL '30 days') as views_last_30d,
  MAX(viewed_at) as last_view_at
FROM bio_page_views
GROUP BY talent_id;

-- Grant access to the view
GRANT SELECT ON bio_page_view_stats TO authenticated, anon;

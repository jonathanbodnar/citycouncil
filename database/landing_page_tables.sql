-- Email Waitlist Table
CREATE TABLE IF NOT EXISTS email_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  source VARCHAR(50) DEFAULT 'landing_page',
  discount_code VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster email lookups
CREATE INDEX IF NOT EXISTS idx_email_waitlist_email ON email_waitlist(email);
CREATE INDEX IF NOT EXISTS idx_email_waitlist_created ON email_waitlist(created_at DESC);

-- Landing Page Promo Videos Table
CREATE TABLE IF NOT EXISTS landing_promo_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_url TEXT NOT NULL,
  title VARCHAR(255),
  description TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for ordering
CREATE INDEX IF NOT EXISTS idx_landing_videos_order ON landing_promo_videos(display_order, is_active);

-- Enable RLS (Row Level Security)
ALTER TABLE email_waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE landing_promo_videos ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert to waitlist
CREATE POLICY "Anyone can join waitlist"
  ON email_waitlist
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Policy: Anyone can read active promo videos
CREATE POLICY "Anyone can view active promo videos"
  ON landing_promo_videos
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Policy: Admins can manage promo videos
CREATE POLICY "Admins can manage promo videos"
  ON landing_promo_videos
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.user_type = 'admin'
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_landing_video_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE TRIGGER update_landing_video_timestamp
  BEFORE UPDATE ON landing_promo_videos
  FOR EACH ROW
  EXECUTE FUNCTION update_landing_video_timestamp();


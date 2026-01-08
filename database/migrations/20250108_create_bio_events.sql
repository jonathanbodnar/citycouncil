-- Create bio_events table for talent events on bio pages
CREATE TABLE IF NOT EXISTS bio_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_id UUID NOT NULL REFERENCES talent_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE,
  event_time TEXT, -- Stored as string like "7:00 PM"
  location TEXT,
  registration_url TEXT,
  button_text TEXT DEFAULT 'Get Tickets',
  image_url TEXT,
  source_type TEXT NOT NULL DEFAULT 'manual' CHECK (source_type IN ('manual', 'ical', 'rss')),
  source_url TEXT, -- For ical/rss feeds
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE bio_events ENABLE ROW LEVEL SECURITY;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_bio_events_talent_id ON bio_events(talent_id);

-- RLS Policies (drop existing first to avoid conflicts)
DROP POLICY IF EXISTS "Talents can manage their own events" ON bio_events;
DROP POLICY IF EXISTS "Public can view active events" ON bio_events;
DROP POLICY IF EXISTS "Admins can manage all events" ON bio_events;

-- Talents can manage their own events
CREATE POLICY "Talents can manage their own events" ON bio_events
FOR ALL TO authenticated
USING (
  talent_id IN (
    SELECT id FROM talent_profiles WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  talent_id IN (
    SELECT id FROM talent_profiles WHERE user_id = auth.uid()
  )
);

-- Public can view active events
CREATE POLICY "Public can view active events" ON bio_events
FOR SELECT TO anon
USING (is_active = true);

-- Admins can manage all events
CREATE POLICY "Admins can manage all events" ON bio_events
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.user_type = 'admin'
  )
);

COMMENT ON TABLE bio_events IS 'Events displayed on talent bio pages - can be manual or synced from iCal/RSS';


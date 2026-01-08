-- Create email_drafts table for talent email updates
CREATE TABLE IF NOT EXISTS email_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_id UUID NOT NULL REFERENCES talent_profiles(id) ON DELETE CASCADE,
  subject TEXT,
  content TEXT,
  button_text TEXT,
  button_url TEXT,
  image_url TEXT,
  image_link_url TEXT,
  scheduled_date DATE,
  scheduled_time TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sent')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Each talent can only have one active draft at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_drafts_talent_draft ON email_drafts(talent_id) WHERE status = 'draft';

CREATE INDEX IF NOT EXISTS idx_email_drafts_talent_id ON email_drafts(talent_id);
CREATE INDEX IF NOT EXISTS idx_email_drafts_status ON email_drafts(status);

-- Disable RLS for simplicity (like bio_events)
ALTER TABLE email_drafts DISABLE ROW LEVEL SECURITY;


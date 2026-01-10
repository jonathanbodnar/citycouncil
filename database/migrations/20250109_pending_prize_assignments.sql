-- Create table for tracking pending prize assignments for email-only giveaway entries
-- These are processed after 60 seconds to give users time to add their phone

CREATE TABLE IF NOT EXISTS pending_prize_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  user_id UUID,
  utm_source TEXT,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'skipped')),
  prize_assigned TEXT,
  coupon_code TEXT,
  processed_at TIMESTAMPTZ,
  skip_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for finding pending assignments
CREATE INDEX IF NOT EXISTS idx_pending_prize_scheduled 
ON pending_prize_assignments(scheduled_for, status) 
WHERE status = 'pending';

-- Index for email lookup
CREATE INDEX IF NOT EXISTS idx_pending_prize_email 
ON pending_prize_assignments(email);

-- Add email_address column to beta_signups if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'beta_signups' AND column_name = 'email_address'
  ) THEN
    ALTER TABLE beta_signups ADD COLUMN email_address TEXT;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE pending_prize_assignments ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role full access to pending_prize_assignments"
ON pending_prize_assignments
FOR ALL
USING (true)
WITH CHECK (true);

-- Grant access to authenticated users to read their own
CREATE POLICY "Users can read own pending assignments"
ON pending_prize_assignments
FOR SELECT
USING (email = current_setting('request.jwt.claims', true)::json->>'email');


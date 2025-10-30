-- Fix RLS policy for email_waitlist to allow counting

-- Add policy to allow anyone to count/read from email_waitlist (needed for spots remaining)
CREATE POLICY "Anyone can count waitlist"
  ON email_waitlist
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- This allows the frontend to run: SELECT count(*) FROM email_waitlist
-- which is needed to calculate spots remaining (197 - count)


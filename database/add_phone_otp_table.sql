-- Create table to store phone OTP codes for login
-- This is a custom implementation using our existing Twilio setup

CREATE TABLE IF NOT EXISTS phone_otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_phone_otp_phone ON phone_otp_codes(phone);
CREATE INDEX IF NOT EXISTS idx_phone_otp_expires ON phone_otp_codes(expires_at);

-- Enable RLS
ALTER TABLE phone_otp_codes ENABLE ROW LEVEL SECURITY;

-- Only service role can access this table (edge functions)
CREATE POLICY "Service role only" ON phone_otp_codes
  FOR ALL
  USING (auth.role() = 'service_role');

-- Function to clean up expired OTP codes (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_otp_codes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM phone_otp_codes 
  WHERE expires_at < NOW() - INTERVAL '1 hour';
END;
$$;

-- Grant execute to service role
GRANT EXECUTE ON FUNCTION cleanup_expired_otp_codes() TO service_role;

-- Comment for documentation
COMMENT ON TABLE phone_otp_codes IS 'Stores temporary OTP codes for phone-based login. Codes expire after 5 minutes.';


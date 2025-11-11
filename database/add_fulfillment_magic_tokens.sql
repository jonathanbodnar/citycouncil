-- Add one-click authentication tokens for fulfillment links
-- This allows talent to click SMS links and auto-login without entering credentials

-- Create fulfillment_auth_tokens table
CREATE TABLE IF NOT EXISTS fulfillment_auth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  used BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  used_at TIMESTAMPTZ
);

-- Create index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_fulfillment_auth_tokens_token ON fulfillment_auth_tokens(token);
CREATE INDEX IF NOT EXISTS idx_fulfillment_auth_tokens_order ON fulfillment_auth_tokens(order_id);
CREATE INDEX IF NOT EXISTS idx_fulfillment_auth_tokens_expires ON fulfillment_auth_tokens(expires_at) WHERE NOT used;

-- Enable RLS
ALTER TABLE fulfillment_auth_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read valid, unused tokens (for login)
CREATE POLICY "Anyone can read valid unused tokens"
ON fulfillment_auth_tokens
FOR SELECT
USING (
  NOT used 
  AND expires_at > NOW()
);

-- Policy: Service role can insert tokens
CREATE POLICY "Service can insert tokens"
ON fulfillment_auth_tokens
FOR INSERT
WITH CHECK (true);

-- Policy: Service role can update tokens (mark as used)
CREATE POLICY "Service can update tokens"
ON fulfillment_auth_tokens
FOR UPDATE
USING (true);

-- Function to generate magic auth token for an order
CREATE OR REPLACE FUNCTION generate_fulfillment_auth_token(
  p_order_id UUID,
  p_user_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token TEXT;
BEGIN
  -- Generate a secure random token (32 bytes = 256 bits)
  v_token := encode(gen_random_bytes(32), 'base64');
  v_token := replace(replace(replace(v_token, '+', '-'), '/', '_'), '=', '');
  
  -- Insert the token (expires in 30 days)
  INSERT INTO fulfillment_auth_tokens (
    order_id,
    user_id,
    token,
    expires_at
  ) VALUES (
    p_order_id,
    p_user_id,
    v_token,
    NOW() + INTERVAL '30 days'
  );
  
  RETURN v_token;
END;
$$;

-- Trigger to auto-generate magic token when order is created
CREATE OR REPLACE FUNCTION auto_generate_magic_token()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_talent_user_id UUID;
  v_magic_token TEXT;
BEGIN
  -- Get the talent's user_id
  SELECT user_id INTO v_talent_user_id
  FROM talent_profiles
  WHERE id = NEW.talent_id;
  
  IF v_talent_user_id IS NOT NULL THEN
    -- Generate magic token
    v_magic_token := generate_fulfillment_auth_token(NEW.id, v_talent_user_id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for new orders
DROP TRIGGER IF EXISTS on_order_created_generate_magic_token ON orders;
CREATE TRIGGER on_order_created_generate_magic_token
AFTER INSERT ON orders
FOR EACH ROW
EXECUTE FUNCTION auto_generate_magic_token();

-- Test: Check if tables and functions exist
SELECT 
  'fulfillment_auth_tokens table' as check_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = 'fulfillment_auth_tokens'
    ) THEN '✅ Table exists'
    ELSE '❌ Table missing'
  END as status;

SELECT 
  'generate_fulfillment_auth_token function' as check_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_proc WHERE proname = 'generate_fulfillment_auth_token'
    ) THEN '✅ Function exists'
    ELSE '❌ Function missing'
  END as status;

SELECT 
  'auto_generate_magic_token trigger' as check_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_trigger WHERE tgname = 'on_order_created_generate_magic_token'
    ) THEN '✅ Trigger exists'
    ELSE '❌ Trigger missing'
  END as status;


-- Internal Link Shortening Service for SMS
-- Generates short URLs like shoutout.us/s/ABC123 that redirect to full fulfillment links

-- Create short_links table
CREATE TABLE IF NOT EXISTS short_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  short_code TEXT NOT NULL UNIQUE,
  target_url TEXT NOT NULL,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  magic_token TEXT, -- Optional: for auto-login links
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- Optional: links can expire
  clicks INTEGER DEFAULT 0,
  last_clicked_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb -- Store additional data (user agent, etc)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_short_links_short_code ON short_links(short_code);
CREATE INDEX IF NOT EXISTS idx_short_links_order_id ON short_links(order_id);
CREATE INDEX IF NOT EXISTS idx_short_links_expires ON short_links(expires_at) WHERE expires_at IS NOT NULL;

-- Enable RLS
ALTER TABLE short_links ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read non-expired links (for redirect)
CREATE POLICY "Anyone can read valid links"
ON short_links
FOR SELECT
USING (
  expires_at IS NULL 
  OR expires_at > NOW()
);

-- Policy: Service role can insert/update links
CREATE POLICY "Service can manage links"
ON short_links
FOR ALL
USING (true);

-- Function to generate a short code (6 characters, URL-safe)
CREATE OR REPLACE FUNCTION generate_short_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  chars TEXT := 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INTEGER;
  char_index INTEGER;
BEGIN
  -- Generate 6 random characters
  FOR i IN 1..6 LOOP
    char_index := floor(random() * length(chars) + 1)::INTEGER;
    result := result || substr(chars, char_index, 1);
  END LOOP;
  
  RETURN result;
END;
$$;

-- Function to create a short link for an order with magic auth
CREATE OR REPLACE FUNCTION create_short_link_for_order(
  p_order_id UUID,
  p_fulfillment_token TEXT,
  p_magic_token TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_short_code TEXT;
  v_target_url TEXT;
  v_base_url TEXT := 'https://shoutout.us';
  v_attempts INTEGER := 0;
  v_max_attempts INTEGER := 10;
BEGIN
  -- Build full target URL with magic auth
  v_target_url := v_base_url || '/fulfill/' || p_fulfillment_token || '?auth=' || p_magic_token;
  
  -- Try to generate a unique short code
  LOOP
    v_short_code := generate_short_code();
    v_attempts := v_attempts + 1;
    
    -- Try to insert
    BEGIN
      INSERT INTO short_links (
        short_code,
        target_url,
        order_id,
        magic_token,
        expires_at
      ) VALUES (
        v_short_code,
        v_target_url,
        p_order_id,
        p_magic_token,
        NOW() + INTERVAL '90 days' -- Links expire in 90 days
      );
      
      -- Success! Return the short code
      RETURN v_short_code;
    EXCEPTION
      WHEN unique_violation THEN
        -- Try again with a new code
        IF v_attempts >= v_max_attempts THEN
          RAISE EXCEPTION 'Failed to generate unique short code after % attempts', v_max_attempts;
        END IF;
        CONTINUE;
    END;
  END LOOP;
END;
$$;

-- Function to track click on a short link
CREATE OR REPLACE FUNCTION track_short_link_click(
  p_short_code TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_target_url TEXT;
BEGIN
  -- Update click count and metadata
  UPDATE short_links
  SET 
    clicks = clicks + 1,
    last_clicked_at = NOW(),
    metadata = CASE 
      WHEN metadata IS NULL THEN p_metadata
      ELSE metadata || p_metadata
    END
  WHERE short_code = p_short_code
    AND (expires_at IS NULL OR expires_at > NOW())
  RETURNING target_url INTO v_target_url;
  
  IF v_target_url IS NULL THEN
    RAISE EXCEPTION 'Short link not found or expired: %', p_short_code;
  END IF;
  
  RETURN v_target_url;
END;
$$;

-- Trigger to auto-create short links when magic tokens are created
CREATE OR REPLACE FUNCTION auto_create_short_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_fulfillment_token TEXT;
  v_short_code TEXT;
BEGIN
  -- Get the fulfillment token for this order
  SELECT fulfillment_token INTO v_fulfillment_token
  FROM orders
  WHERE id = NEW.order_id;
  
  IF v_fulfillment_token IS NOT NULL THEN
    -- Create short link
    v_short_code := create_short_link_for_order(
      NEW.order_id,
      v_fulfillment_token,
      NEW.token
    );
    
    -- Log success
    RAISE NOTICE 'Created short link: % for order %', v_short_code, NEW.order_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on fulfillment_auth_tokens
DROP TRIGGER IF EXISTS on_magic_token_created_make_short_link ON fulfillment_auth_tokens;
CREATE TRIGGER on_magic_token_created_make_short_link
AFTER INSERT ON fulfillment_auth_tokens
FOR EACH ROW
EXECUTE FUNCTION auto_create_short_link();

-- View to see short link analytics
CREATE OR REPLACE VIEW short_link_analytics AS
SELECT 
  sl.short_code,
  sl.order_id,
  o.status as order_status,
  u.email as customer_email,
  t.full_name as talent_name,
  sl.clicks,
  sl.created_at,
  sl.last_clicked_at,
  sl.expires_at,
  CASE 
    WHEN sl.expires_at IS NOT NULL AND sl.expires_at < NOW() THEN 'expired'
    WHEN sl.clicks > 0 THEN 'used'
    ELSE 'unused'
  END as link_status
FROM short_links sl
LEFT JOIN orders o ON sl.order_id = o.id
LEFT JOIN users u ON o.user_id = u.id
LEFT JOIN talent_profiles tp ON o.talent_id = tp.id
LEFT JOIN users t ON tp.user_id = t.id
ORDER BY sl.created_at DESC;

-- Test: Verify tables and functions exist
SELECT 
  'short_links table' as check_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = 'short_links'
    ) THEN '✅ Table exists'
    ELSE '❌ Table missing'
  END as status;

SELECT 
  'create_short_link_for_order function' as check_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_proc WHERE proname = 'create_short_link_for_order'
    ) THEN '✅ Function exists'
    ELSE '❌ Function missing'
  END as status;

SELECT 
  'auto_create_short_link trigger' as check_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_trigger WHERE tgname = 'on_magic_token_created_make_short_link'
    ) THEN '✅ Trigger exists'
    ELSE '❌ Trigger missing'
  END as status;

-- Show any existing short links
SELECT 
  short_code,
  LEFT(target_url, 50) || '...' as target_url_preview,
  clicks,
  created_at
FROM short_links
ORDER BY created_at DESC
LIMIT 5;


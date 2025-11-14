-- Create beta_signups table for landing page phone submissions
-- These are lightweight signups that don't require full user accounts

CREATE TABLE IF NOT EXISTS beta_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL UNIQUE,
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  source TEXT DEFAULT 'landing_page',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for fast phone lookups
CREATE INDEX IF NOT EXISTS idx_beta_signups_phone ON beta_signups(phone_number);

-- Enable RLS
ALTER TABLE beta_signups ENABLE ROW LEVEL SECURITY;

-- Allow anonymous users to insert (for landing page)
CREATE POLICY "Anyone can signup for beta" ON beta_signups
  FOR INSERT TO anon
  WITH CHECK (true);

-- Allow authenticated users to read their own signup
CREATE POLICY "Users can view their own beta signup" ON beta_signups
  FOR SELECT TO authenticated
  USING (true);

-- Admin can see all
CREATE POLICY "Admins can view all beta signups" ON beta_signups
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.user_type = 'admin'
    )
  );

-- Count function for spots remaining
CREATE OR REPLACE FUNCTION get_beta_spots_remaining()
RETURNS INT AS $$
DECLARE
  total_beta_users INT;
  max_beta_spots INT := 250; -- Adjust this number as needed
BEGIN
  SELECT COUNT(*) INTO total_beta_users FROM beta_signups;
  RETURN GREATEST(0, max_beta_spots - total_beta_users);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update get_users_by_segment to include beta_signups
CREATE OR REPLACE FUNCTION get_users_by_segment(segment TEXT)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  email TEXT,
  phone_number TEXT,
  user_tags TEXT[]
) AS $$
BEGIN
  IF segment = 'beta' THEN
    -- Return both beta_signups AND users with 'beta' tag
    RETURN QUERY
    SELECT 
      bs.id,
      ''::TEXT as full_name,
      ''::TEXT as email,
      bs.phone_number,
      ARRAY['beta']::TEXT[] as user_tags
    FROM beta_signups bs
    
    UNION ALL
    
    SELECT u.id, u.full_name, u.email, u.phone as phone_number, u.user_tags
    FROM users u
    WHERE 'beta' = ANY(u.user_tags)
    AND u.sms_subscribed = true
    AND u.phone IS NOT NULL;
    
  ELSIF segment = 'registered' THEN
    RETURN QUERY
    SELECT u.id, u.full_name, u.email, u.phone as phone_number, u.user_tags
    FROM users u
    WHERE u.sms_subscribed = true
    AND u.phone IS NOT NULL
    AND u.user_type = 'user'
    AND NOT ('beta' = ANY(u.user_tags));
    
  ELSIF segment = 'all' THEN
    -- Return ALL: beta_signups + users with sms_subscribed
    RETURN QUERY
    SELECT 
      bs.id,
      ''::TEXT as full_name,
      ''::TEXT as email,
      bs.phone_number,
      ARRAY['beta']::TEXT[] as user_tags
    FROM beta_signups bs
    
    UNION ALL
    
    SELECT u.id, u.full_name, u.email, u.phone as phone_number, u.user_tags
    FROM users u
    WHERE u.sms_subscribed = true
    AND u.phone IS NOT NULL
    AND u.user_type = 'user';
    
  ELSIF segment = 'talent' THEN
    RETURN QUERY
    SELECT u.id, u.full_name, u.email, u.phone as phone_number, u.user_tags
    FROM users u
    WHERE u.phone IS NOT NULL
    AND u.user_type = 'talent';
    
  ELSE
    -- Return empty set for invalid segment
    RETURN QUERY
    SELECT u.id, u.full_name, u.email, u.phone as phone_number, u.user_tags
    FROM users u
    WHERE false;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update get_sms_stats to include beta_signups
CREATE OR REPLACE FUNCTION get_sms_stats()
RETURNS TABLE (
  total_campaigns INT,
  total_sent INT,
  total_failed INT,
  beta_subscribers INT,
  registered_subscribers INT,
  total_subscribers INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*)::INT FROM sms_campaigns),
    (SELECT COALESCE(SUM(sent_count), 0)::INT FROM sms_campaigns),
    (SELECT COALESCE(SUM(failed_count), 0)::INT FROM sms_campaigns),
    -- Beta = beta_signups + users with 'beta' tag
    ((SELECT COUNT(*)::INT FROM beta_signups) + 
     (SELECT COUNT(*)::INT FROM users WHERE 'beta' = ANY(user_tags) AND sms_subscribed = true)),
    (SELECT COUNT(*)::INT FROM users WHERE sms_subscribed = true AND user_type = 'user' AND NOT ('beta' = ANY(user_tags))),
    -- Total = beta_signups + all sms_subscribed users
    ((SELECT COUNT(*)::INT FROM beta_signups) +
     (SELECT COUNT(*)::INT FROM users WHERE sms_subscribed = true));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify setup
SELECT 
  'Beta signups table created!' as status,
  (SELECT COUNT(*) FROM beta_signups) as current_signups,
  get_beta_spots_remaining() as spots_remaining;


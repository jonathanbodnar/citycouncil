-- Add SMS Features for Comms Center
-- Supports user segmentation and mass SMS campaigns

-- 1. Add user tags for segmentation
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS user_tags TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS sms_subscribed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS sms_subscribed_at TIMESTAMPTZ;

-- Add index for efficient tag filtering
CREATE INDEX IF NOT EXISTS idx_users_tags 
ON users USING GIN(user_tags);

CREATE INDEX IF NOT EXISTS idx_users_sms_subscribed 
ON users(sms_subscribed) WHERE sms_subscribed = true;

-- 2. Create SMS campaigns table for tracking
CREATE TABLE IF NOT EXISTS sms_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  campaign_name TEXT NOT NULL,
  message TEXT NOT NULL,
  target_audience TEXT NOT NULL, -- 'beta', 'registered', 'all', 'talent'
  recipient_count INT DEFAULT 0,
  sent_count INT DEFAULT 0,
  failed_count INT DEFAULT 0,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sending', 'completed', 'failed')),
  scheduled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- 3. Create SMS logs table for individual sends
CREATE TABLE IF NOT EXISTS sms_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  campaign_id UUID REFERENCES sms_campaigns(id) ON DELETE SET NULL,
  recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  twilio_sid TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Add indexes for SMS logs
CREATE INDEX IF NOT EXISTS idx_sms_logs_campaign 
ON sms_logs(campaign_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sms_logs_recipient 
ON sms_logs(recipient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sms_logs_status 
ON sms_logs(status, created_at DESC);

-- 4. Add RLS policies for SMS campaigns (admin only)
ALTER TABLE sms_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all SMS campaigns"
ON sms_campaigns FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.is_admin = true
  )
);

CREATE POLICY "Admins can create SMS campaigns"
ON sms_campaigns FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.is_admin = true
  )
);

CREATE POLICY "Admins can update SMS campaigns"
ON sms_campaigns FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.is_admin = true
  )
);

-- 5. Add RLS policies for SMS logs (admin only)
ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all SMS logs"
ON sms_logs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.is_admin = true
  )
);

CREATE POLICY "System can insert SMS logs"
ON sms_logs FOR INSERT
TO authenticated
WITH CHECK (true);

-- 6. Helper function to get users by segment
CREATE OR REPLACE FUNCTION get_users_by_segment(segment TEXT)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  email TEXT,
  phone_number TEXT,
  user_tags TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  CASE segment
    WHEN 'beta' THEN
      SELECT u.id, u.full_name, u.email, u.phone_number, u.user_tags
      FROM users u
      WHERE 'beta' = ANY(u.user_tags)
      AND u.sms_subscribed = true
      AND u.phone_number IS NOT NULL
      AND u.user_type = 'user';
      
    WHEN 'registered' THEN
      SELECT u.id, u.full_name, u.email, u.phone_number, u.user_tags
      FROM users u
      WHERE u.sms_subscribed = true
      AND u.phone_number IS NOT NULL
      AND u.user_type = 'user'
      AND NOT ('beta' = ANY(u.user_tags));
      
    WHEN 'all' THEN
      SELECT u.id, u.full_name, u.email, u.phone_number, u.user_tags
      FROM users u
      WHERE u.sms_subscribed = true
      AND u.phone_number IS NOT NULL
      AND u.user_type = 'user';
      
    WHEN 'talent' THEN
      SELECT u.id, u.full_name, u.email, u.phone_number, u.user_tags
      FROM users u
      WHERE u.phone_number IS NOT NULL
      AND u.user_type = 'talent';
      
    ELSE
      -- Return empty set for invalid segment
      SELECT u.id, u.full_name, u.email, u.phone_number, u.user_tags
      FROM users u
      WHERE false;
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Function to get SMS statistics
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
    (SELECT COUNT(*)::INT FROM users WHERE 'beta' = ANY(user_tags) AND sms_subscribed = true),
    (SELECT COUNT(*)::INT FROM users WHERE sms_subscribed = true AND user_type = 'user' AND NOT ('beta' = ANY(user_tags))),
    (SELECT COUNT(*)::INT FROM users WHERE sms_subscribed = true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Show summary of changes
SELECT 
  '✅ SMS features added successfully!' as status,
  'Users can now be tagged and segmented for SMS campaigns' as note;

-- Show current user segmentation
SELECT 
  'beta' as segment,
  COUNT(*) as subscriber_count
FROM users
WHERE 'beta' = ANY(user_tags) AND sms_subscribed = true
UNION ALL
SELECT 
  'registered' as segment,
  COUNT(*) as subscriber_count
FROM users
WHERE sms_subscribed = true AND user_type = 'user' AND NOT ('beta' = ANY(user_tags))
UNION ALL
SELECT 
  'talent' as segment,
  COUNT(*) as subscriber_count
FROM users
WHERE user_type = 'talent' AND phone_number IS NOT NULL;


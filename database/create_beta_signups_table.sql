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

-- ============================================
-- AUTOMATIC MERGE: Beta Signup → Full User
-- ============================================
-- When a user signs up with a beta phone number:
-- 1. Auto-add 'beta' tag
-- 2. Enable SMS subscription
-- 3. Delete beta_signup record (prevent duplicates)

CREATE OR REPLACE FUNCTION merge_beta_signup_to_user()
RETURNS TRIGGER AS $$
DECLARE
  beta_record RECORD;
BEGIN
  -- Check if this phone number exists in beta_signups
  SELECT * INTO beta_record
  FROM beta_signups
  WHERE phone_number = NEW.phone;
  
  IF FOUND THEN
    -- User was a beta signup! Add 'beta' tag and enable SMS
    NEW.user_tags := COALESCE(NEW.user_tags, ARRAY[]::TEXT[]);
    
    -- Add 'beta' tag if not already present
    IF NOT ('beta' = ANY(NEW.user_tags)) THEN
      NEW.user_tags := array_append(NEW.user_tags, 'beta');
    END IF;
    
    -- Enable SMS subscription (they already opted in)
    NEW.sms_subscribed := true;
    NEW.sms_subscribed_at := beta_record.subscribed_at;
    
    -- Delete the beta_signup record (no longer needed)
    DELETE FROM beta_signups WHERE id = beta_record.id;
    
    RAISE NOTICE '✅ Merged beta signup into user account';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for INSERT (new user signup)
DROP TRIGGER IF EXISTS trigger_merge_beta_signup ON users;
CREATE TRIGGER trigger_merge_beta_signup
  BEFORE INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION merge_beta_signup_to_user();

-- Trigger for UPDATE (phone added later)
CREATE OR REPLACE FUNCTION merge_beta_signup_on_phone_update()
RETURNS TRIGGER AS $$
DECLARE
  beta_record RECORD;
BEGIN
  -- Only if phone was just added/changed
  IF NEW.phone IS NOT NULL AND (OLD.phone IS NULL OR OLD.phone != NEW.phone) THEN
    SELECT * INTO beta_record
    FROM beta_signups
    WHERE phone_number = NEW.phone;
    
    IF FOUND THEN
      NEW.user_tags := COALESCE(NEW.user_tags, ARRAY[]::TEXT[]);
      IF NOT ('beta' = ANY(NEW.user_tags)) THEN
        NEW.user_tags := array_append(NEW.user_tags, 'beta');
      END IF;
      NEW.sms_subscribed := true;
      IF NEW.sms_subscribed_at IS NULL THEN
        NEW.sms_subscribed_at := beta_record.subscribed_at;
      END IF;
      DELETE FROM beta_signups WHERE id = beta_record.id;
      RAISE NOTICE '✅ Merged beta signup on phone update';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_merge_beta_signup_on_update ON users;
CREATE TRIGGER trigger_merge_beta_signup_on_update
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION merge_beta_signup_on_phone_update();

-- Verify setup
SELECT 
  'Beta signups table created!' as status,
  (SELECT COUNT(*) FROM beta_signups) as current_signups,
  get_beta_spots_remaining() as spots_remaining;


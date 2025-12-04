-- Add Holiday Popup segment to SMS system
-- This allows admin to text users who signed up via the holiday promo popup

-- Update get_users_by_segment to include holiday_popup
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
    -- Return both beta_signups (excluding holiday_popup) AND users with 'beta' tag
    RETURN QUERY
    SELECT 
      bs.id,
      ''::TEXT as full_name,
      ''::TEXT as email,
      bs.phone_number,
      ARRAY['beta']::TEXT[] as user_tags
    FROM beta_signups bs
    WHERE bs.source != 'holiday_popup' OR bs.source IS NULL
    
    UNION ALL
    
    SELECT u.id, u.full_name, u.email, u.phone as phone_number, u.user_tags
    FROM users u
    WHERE 'beta' = ANY(COALESCE(u.user_tags, ARRAY[]::TEXT[]))
    AND u.sms_subscribed = true
    AND u.phone IS NOT NULL;
    
  ELSIF segment = 'holiday_popup' THEN
    -- Return only holiday popup signups from beta_signups
    RETURN QUERY
    SELECT 
      bs.id,
      ''::TEXT as full_name,
      ''::TEXT as email,
      bs.phone_number,
      ARRAY['holiday_popup']::TEXT[] as user_tags
    FROM beta_signups bs
    WHERE bs.source = 'holiday_popup';
    
  ELSIF segment = 'registered' THEN
    RETURN QUERY
    SELECT u.id, u.full_name, u.email, u.phone as phone_number, u.user_tags
    FROM users u
    WHERE u.sms_subscribed = true
    AND u.phone IS NOT NULL
    AND u.user_type = 'user'
    AND NOT ('beta' = ANY(COALESCE(u.user_tags, ARRAY[]::TEXT[])));
    
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

-- Update get_sms_stats to include holiday_popup count
CREATE OR REPLACE FUNCTION get_sms_stats()
RETURNS TABLE (
  total_campaigns INT,
  total_sent INT,
  total_failed INT,
  beta_subscribers INT,
  registered_subscribers INT,
  total_subscribers INT,
  holiday_popup_subscribers INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*)::INT FROM sms_campaigns),
    (SELECT COALESCE(SUM(sent_count), 0)::INT FROM sms_campaigns),
    (SELECT COALESCE(SUM(failed_count), 0)::INT FROM sms_campaigns),
    -- Beta = beta_signups (excluding holiday_popup) + users with 'beta' tag
    ((SELECT COUNT(*)::INT FROM beta_signups WHERE source != 'holiday_popup' OR source IS NULL) + 
     (SELECT COUNT(*)::INT FROM users WHERE 'beta' = ANY(COALESCE(user_tags, ARRAY[]::TEXT[])) AND sms_subscribed = true)),
    -- Registered = users without 'beta' tag (including NULL user_tags)
    (SELECT COUNT(*)::INT FROM users WHERE sms_subscribed = true AND user_type = 'user' AND NOT ('beta' = ANY(COALESCE(user_tags, ARRAY[]::TEXT[])))),
    -- Total = beta_signups + all sms_subscribed users
    ((SELECT COUNT(*)::INT FROM beta_signups) +
     (SELECT COUNT(*)::INT FROM users WHERE sms_subscribed = true)),
    -- Holiday Popup = beta_signups with source = 'holiday_popup'
    (SELECT COUNT(*)::INT FROM beta_signups WHERE source = 'holiday_popup');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Show current holiday popup signups
SELECT 
  'Holiday Popup Signups' as segment,
  COUNT(*) as count
FROM beta_signups
WHERE source = 'holiday_popup';


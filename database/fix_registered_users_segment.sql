-- Fix get_users_by_segment to show ALL registered users
-- Currently "registered" excludes users with 'beta' tag
-- This should show ALL users who have accounts (beta tag or not)

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
    -- Return ONLY beta_signups (not full accounts)
    RETURN QUERY
    SELECT 
      bs.id,
      ''::TEXT as full_name,
      ''::TEXT as email,
      bs.phone_number,
      ARRAY['beta']::TEXT[] as user_tags
    FROM beta_signups bs;
    
  ELSIF segment = 'registered' THEN
    -- Return ALL users with accounts (including those with beta tags)
    RETURN QUERY
    SELECT u.id, u.full_name, u.email, u.phone as phone_number, u.user_tags
    FROM users u
    WHERE u.sms_subscribed = true
    AND u.phone IS NOT NULL
    AND u.user_type = 'user';  -- Removed the beta tag exclusion!
    
  ELSIF segment = 'all' THEN
    -- Return ALL: beta_signups + all registered users
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
    WHERE u.sms_subscribed = true
    AND u.phone IS NOT NULL
    AND u.user_type = 'talent';
    
  ELSE
    RETURN;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Verify the fix
SELECT 
    '✅ BETA SIGNUPS (landing page only)' AS segment,
    COUNT(*) AS count
FROM get_users_by_segment('beta');

SELECT 
    '✅ REGISTERED USERS (all full accounts)' AS segment,
    COUNT(*) AS count
FROM get_users_by_segment('registered');

SELECT 
    '✅ ALL USERS' AS segment,
    COUNT(*) AS count
FROM get_users_by_segment('all');

-- Show sample registered users to verify
SELECT 
    '📋 SAMPLE REGISTERED USERS' AS info,
    full_name,
    email,
    phone_number,
    user_tags
FROM get_users_by_segment('registered')
ORDER BY full_name
LIMIT 10;

SELECT '✅ Fixed! Registered segment now shows ALL users with accounts (beta tag or not).' AS status;


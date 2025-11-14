-- Fix registered users count in Comms Center
-- Issue: Registered users with NULL user_tags aren't being counted

-- PROBLEM:
-- Line 144: NOT ('beta' = ANY(user_tags))
-- If user_tags is NULL, this returns NULL (not TRUE or FALSE)
-- NULL in WHERE clause = row excluded

-- TEST: Show current issue
SELECT 
  'Current registered users count' as test,
  COUNT(*) as count
FROM users 
WHERE sms_subscribed = true 
  AND user_type = 'user' 
  AND NOT ('beta' = ANY(user_tags));  -- BROKEN: NULL user_tags excluded

SELECT 
  'Fixed registered users count' as test,
  COUNT(*) as count
FROM users 
WHERE sms_subscribed = true 
  AND user_type = 'user' 
  AND NOT ('beta' = ANY(COALESCE(user_tags, ARRAY[]::TEXT[])));  -- FIXED: NULL treated as empty array

-- Show users being excluded
SELECT 
  'Users currently excluded (NULL user_tags)' as issue,
  id,
  email,
  phone,
  user_tags,
  sms_subscribed,
  created_at
FROM users
WHERE sms_subscribed = true
  AND user_type = 'user'
  AND user_tags IS NULL
ORDER BY created_at DESC;

-- FIX 1: Update get_sms_stats function
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
     (SELECT COUNT(*)::INT FROM users WHERE 'beta' = ANY(COALESCE(user_tags, ARRAY[]::TEXT[])) AND sms_subscribed = true)),
    -- Registered = users without 'beta' tag (including NULL user_tags)
    (SELECT COUNT(*)::INT FROM users WHERE sms_subscribed = true AND user_type = 'user' AND NOT ('beta' = ANY(COALESCE(user_tags, ARRAY[]::TEXT[])))),
    -- Total = beta_signups + all sms_subscribed users
    ((SELECT COUNT(*)::INT FROM beta_signups) +
     (SELECT COUNT(*)::INT FROM users WHERE sms_subscribed = true));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- FIX 2: Update get_users_by_segment function
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
    WHERE 'beta' = ANY(COALESCE(u.user_tags, ARRAY[]::TEXT[]))
    AND u.sms_subscribed = true
    AND u.phone IS NOT NULL;
    
  ELSIF segment = 'registered' THEN
    RETURN QUERY
    SELECT u.id, u.full_name, u.email, u.phone as phone_number, u.user_tags
    FROM users u
    WHERE u.sms_subscribed = true
    AND u.phone IS NOT NULL
    AND u.user_type = 'user'
    AND NOT ('beta' = ANY(COALESCE(u.user_tags, ARRAY[]::TEXT[])));  -- FIXED
    
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

-- VERIFY THE FIX
SELECT '=== VERIFICATION ===' as status;

-- Test the fixed function
SELECT * FROM get_sms_stats();

-- Show users in each segment
SELECT 'Beta segment' as segment, COUNT(*) as count FROM get_users_by_segment('beta');
SELECT 'Registered segment' as segment, COUNT(*) as count FROM get_users_by_segment('registered');
SELECT 'All segment' as segment, COUNT(*) as count FROM get_users_by_segment('all');

-- Show actual registered users
SELECT 
  'Registered users (should include NULL user_tags now)' as info,
  id,
  email,
  phone,
  user_tags,
  sms_subscribed
FROM users
WHERE sms_subscribed = true
  AND user_type = 'user'
  AND NOT ('beta' = ANY(COALESCE(user_tags, ARRAY[]::TEXT[])))
ORDER BY created_at DESC
LIMIT 10;


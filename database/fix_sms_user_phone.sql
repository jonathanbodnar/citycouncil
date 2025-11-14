-- Fix SMS user phone issues
-- Problem: Users have phone numbers but they're not showing up in SMS system
-- Reason 1: Column is 'phone' but functions look for 'phone_number'
-- Reason 2: sms_subscribed is not set during registration

-- First, let's check what the actual column name is
DO $$
DECLARE
  has_phone_column BOOLEAN;
  has_phone_number_column BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'phone'
  ) INTO has_phone_column;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'phone_number'
  ) INTO has_phone_number_column;
  
  RAISE NOTICE 'users.phone exists: %', has_phone_column;
  RAISE NOTICE 'users.phone_number exists: %', has_phone_number_column;
END $$;

-- FIX 1: Update get_users_by_segment to use correct column name (phone instead of phone_number)
CREATE OR REPLACE FUNCTION get_users_by_segment(segment TEXT)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  email TEXT,
  phone_number TEXT,  -- Keep return type as phone_number for API compatibility
  user_tags TEXT[]
) AS $$
BEGIN
  IF segment = 'beta' THEN
    RETURN QUERY
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
    RETURN QUERY
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

-- FIX 2: Auto-subscribe registered users with phone numbers to SMS
-- This makes all existing users with phone numbers SMS-eligible
UPDATE users
SET sms_subscribed = true
WHERE phone IS NOT NULL
  AND phone != ''
  AND (sms_subscribed IS NULL OR sms_subscribed = false);

-- FIX 3: Create trigger to auto-subscribe new users with phone numbers
CREATE OR REPLACE FUNCTION auto_subscribe_sms()
RETURNS TRIGGER AS $$
BEGIN
  -- If user has a phone number and sms_subscribed is not explicitly set to false
  IF NEW.phone IS NOT NULL AND NEW.phone != '' AND NEW.sms_subscribed IS NULL THEN
    NEW.sms_subscribed := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS trigger_auto_subscribe_sms ON users;

-- Create trigger for new users
CREATE TRIGGER trigger_auto_subscribe_sms
  BEFORE INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION auto_subscribe_sms();

-- Verify the fix
SELECT 
  'Fixed!' as status,
  COUNT(*) FILTER (WHERE phone IS NOT NULL AND sms_subscribed = true) as users_with_sms,
  COUNT(*) FILTER (WHERE phone IS NOT NULL) as total_users_with_phone
FROM users
WHERE user_type = 'user';


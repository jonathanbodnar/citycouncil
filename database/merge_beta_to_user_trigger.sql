-- Trigger to handle beta signup → full user conversion
-- When a user signs up with a phone number that exists in beta_signups:
-- 1. Tag them with 'beta' automatically
-- 2. Keep their sms_subscribed status
-- 3. Delete the beta_signup record (no duplicate)

-- Function to merge beta signup when user is created
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
    
    -- Enable SMS subscription (they already opted in via beta signup)
    NEW.sms_subscribed := true;
    NEW.sms_subscribed_at := beta_record.subscribed_at;
    
    -- Delete the beta_signup record (no longer needed)
    DELETE FROM beta_signups WHERE id = beta_record.id;
    
    RAISE NOTICE 'Merged beta signup for phone % into user account', NEW.phone;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_merge_beta_signup ON users;

-- Create trigger that runs BEFORE INSERT on users
CREATE TRIGGER trigger_merge_beta_signup
  BEFORE INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION merge_beta_signup_to_user();

-- Also handle UPDATE case (if phone is added later)
CREATE OR REPLACE FUNCTION merge_beta_signup_on_phone_update()
RETURNS TRIGGER AS $$
DECLARE
  beta_record RECORD;
BEGIN
  -- Only run if phone was just added or changed
  IF NEW.phone IS NOT NULL AND (OLD.phone IS NULL OR OLD.phone != NEW.phone) THEN
    
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
      
      -- Enable SMS subscription
      NEW.sms_subscribed := true;
      IF NEW.sms_subscribed_at IS NULL THEN
        NEW.sms_subscribed_at := beta_record.subscribed_at;
      END IF;
      
      -- Delete the beta_signup record
      DELETE FROM beta_signups WHERE id = beta_record.id;
      
      RAISE NOTICE 'Merged beta signup for phone % into existing user', NEW.phone;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_merge_beta_signup_on_update ON users;

-- Create trigger that runs BEFORE UPDATE on users
CREATE TRIGGER trigger_merge_beta_signup_on_update
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION merge_beta_signup_on_phone_update();

-- Test the merge behavior
DO $$
BEGIN
  RAISE NOTICE '✅ Beta signup merge triggers installed!';
  RAISE NOTICE '📱 When a user signs up with a beta phone number:';
  RAISE NOTICE '   1. They get "beta" tag automatically';
  RAISE NOTICE '   2. SMS subscription is enabled';
  RAISE NOTICE '   3. Beta signup record is deleted';
  RAISE NOTICE '   4. No conflicts!';
END $$;


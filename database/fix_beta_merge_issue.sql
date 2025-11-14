-- Fix beta merge issue when phone formats don't match
-- This handles cases where beta_signups has +1 but users doesn't (or vice versa)

-- STEP 1: Check current state
SELECT '=== CURRENT STATE ===' as status;

SELECT 
  'Beta signups (not merged)' as type,
  phone_number,
  subscribed_at
FROM beta_signups
ORDER BY created_at DESC;

SELECT 
  'Users with phones' as type,
  email,
  phone,
  user_tags,
  sms_subscribed
FROM users
WHERE phone IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

-- STEP 2: Find orphaned beta signups (should have been merged but weren't)
-- Check both with and without +1 prefix
SELECT '=== ORPHANED BETA SIGNUPS ===' as status;

SELECT 
  bs.phone_number as beta_phone,
  u.phone as user_phone,
  u.email as user_email,
  u.user_tags as current_tags,
  u.sms_subscribed as current_sms_status
FROM beta_signups bs
LEFT JOIN users u ON (
  -- Match with or without +1 prefix
  bs.phone_number = u.phone OR
  bs.phone_number = '+1' || u.phone OR
  REPLACE(bs.phone_number, '+1', '') = u.phone
)
WHERE u.id IS NOT NULL;

-- STEP 3: Manually merge orphaned beta signups
-- This updates users who should have been merged
WITH matched_users AS (
  SELECT DISTINCT
    u.id as user_id,
    bs.id as beta_id,
    bs.subscribed_at,
    u.user_tags as current_tags
  FROM beta_signups bs
  JOIN users u ON (
    bs.phone_number = u.phone OR
    bs.phone_number = '+1' || u.phone OR
    REPLACE(bs.phone_number, '+1', '') = u.phone
  )
)
UPDATE users
SET 
  user_tags = CASE 
    WHEN 'beta' = ANY(COALESCE(user_tags, ARRAY[]::TEXT[])) 
    THEN user_tags
    ELSE array_append(COALESCE(user_tags, ARRAY[]::TEXT[]), 'beta')
  END,
  sms_subscribed = true,
  sms_subscribed_at = COALESCE(sms_subscribed_at, (
    SELECT subscribed_at FROM matched_users mu WHERE mu.user_id = users.id
  ))
WHERE id IN (SELECT user_id FROM matched_users);

-- STEP 4: Delete beta_signups that have been merged
DELETE FROM beta_signups
WHERE phone_number IN (
  SELECT bs.phone_number
  FROM beta_signups bs
  JOIN users u ON (
    bs.phone_number = u.phone OR
    bs.phone_number = '+1' || u.phone OR
    REPLACE(bs.phone_number, '+1', '') = u.phone
  )
);

-- STEP 5: Update trigger to handle phone format variations
CREATE OR REPLACE FUNCTION merge_beta_signup_to_user()
RETURNS TRIGGER AS $$
DECLARE
  beta_record RECORD;
BEGIN
  -- Check if this phone number exists in beta_signups
  -- Handle both +1XXXXXXXXXX and XXXXXXXXXX formats
  SELECT * INTO beta_record
  FROM beta_signups
  WHERE phone_number = NEW.phone
     OR phone_number = '+1' || NEW.phone
     OR REPLACE(phone_number, '+1', '') = NEW.phone;
  
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
    
    RAISE NOTICE '✅ Merged beta signup into user account (phone: %)', NEW.phone;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
DROP TRIGGER IF EXISTS trigger_merge_beta_signup ON users;
CREATE TRIGGER trigger_merge_beta_signup
  BEFORE INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION merge_beta_signup_to_user();

-- STEP 6: Update trigger for phone updates
CREATE OR REPLACE FUNCTION merge_beta_signup_on_phone_update()
RETURNS TRIGGER AS $$
DECLARE
  beta_record RECORD;
BEGIN
  -- Only if phone was just added/changed
  IF NEW.phone IS NOT NULL AND (OLD.phone IS NULL OR OLD.phone != NEW.phone) THEN
    SELECT * INTO beta_record
    FROM beta_signups
    WHERE phone_number = NEW.phone
       OR phone_number = '+1' || NEW.phone
       OR REPLACE(phone_number, '+1', '') = NEW.phone;
    
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
      RAISE NOTICE '✅ Merged beta signup on phone update (phone: %)', NEW.phone;
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

-- STEP 7: Verify the fix
SELECT '=== VERIFICATION ===' as status;

SELECT 
  'Users now tagged with beta' as result,
  COUNT(*) as count
FROM users
WHERE 'beta' = ANY(user_tags);

SELECT 
  'Remaining beta_signups (not yet registered)' as result,
  COUNT(*) as count
FROM beta_signups;

SELECT 
  'SMS-subscribed users' as result,
  COUNT(*) as count
FROM users
WHERE sms_subscribed = true;

-- Show the fixed users
SELECT 
  'Fixed users' as type,
  email,
  phone,
  user_tags,
  sms_subscribed,
  sms_subscribed_at
FROM users
WHERE 'beta' = ANY(user_tags)
ORDER BY created_at DESC;


-- Fix: Users registering with phone aren't getting sms_subscribed = true
-- Issue: Trigger might not be firing or UPSERT bypasses trigger

-- 1. Check current state
SELECT 
  'Users with phone but NULL sms_subscribed' as issue,
  COUNT(*) as count
FROM users
WHERE phone IS NOT NULL
  AND phone != ''
  AND sms_subscribed IS NULL;

-- 2. Show these users
SELECT 
  'Users needing fix' as status,
  id,
  email,
  phone,
  sms_subscribed,
  user_tags,
  created_at
FROM users
WHERE phone IS NOT NULL
  AND phone != ''
  AND sms_subscribed IS NULL
ORDER BY created_at DESC;

-- 3. FIX: Set sms_subscribed = true for all users with phone numbers
UPDATE users
SET sms_subscribed = true,
    sms_subscribed_at = COALESCE(sms_subscribed_at, created_at)
WHERE phone IS NOT NULL
  AND phone != ''
  AND (sms_subscribed IS NULL OR sms_subscribed = false);

-- 4. Verify the fix
SELECT 
  '✅ Fixed users' as status,
  COUNT(*) as count
FROM users
WHERE phone IS NOT NULL
  AND phone != ''
  AND sms_subscribed = true;

-- 5. Update the trigger to work with UPSERT
-- The problem: UPSERT might bypass BEFORE INSERT trigger
-- Solution: Also add BEFORE UPDATE trigger

CREATE OR REPLACE FUNCTION auto_subscribe_sms()
RETURNS TRIGGER AS $$
BEGIN
  -- If user has a phone number, auto-subscribe to SMS
  IF NEW.phone IS NOT NULL AND NEW.phone != '' THEN
    -- Only set if not explicitly set to false
    IF NEW.sms_subscribed IS NULL THEN
      NEW.sms_subscribed := true;
      NEW.sms_subscribed_at := COALESCE(NEW.sms_subscribed_at, NOW());
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate triggers
DROP TRIGGER IF EXISTS trigger_auto_subscribe_sms ON users;
DROP TRIGGER IF EXISTS trigger_auto_subscribe_sms_update ON users;

-- Trigger for INSERT
CREATE TRIGGER trigger_auto_subscribe_sms
  BEFORE INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION auto_subscribe_sms();

-- Trigger for UPDATE (for UPSERT operations)
CREATE TRIGGER trigger_auto_subscribe_sms_update
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION auto_subscribe_sms();

-- 6. Test queries to verify everything works
SELECT 
  '=== VERIFICATION ===' as status;

-- Show all users with phones
SELECT 
  'All users with phones' as category,
  email,
  phone,
  sms_subscribed,
  user_tags,
  created_at
FROM users
WHERE phone IS NOT NULL AND phone != ''
ORDER BY created_at DESC
LIMIT 10;

-- Show SMS stats
SELECT * FROM get_sms_stats();

-- Show registered users segment
SELECT 
  'Registered users segment' as segment,
  COUNT(*) as count
FROM get_users_by_segment('registered');

-- Show actual registered users
SELECT 
  'Registered users list' as list,
  email,
  phone_number,
  user_tags,
  full_name
FROM get_users_by_segment('registered')
LIMIT 10;


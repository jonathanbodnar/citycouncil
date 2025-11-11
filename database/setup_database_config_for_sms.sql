-- Setup database configuration for SMS notifications from triggers

-- 1. Check current database settings
SELECT 
  'Current Database Config' as check_type,
  name, 
  setting,
  CASE 
    WHEN setting IS NULL OR setting = '' THEN '❌ NOT SET'
    ELSE '✅ SET'
  END as status
FROM pg_settings 
WHERE name IN ('app.supabase_url', 'app.supabase_anon_key');

-- 2. Check if pg_net extension is enabled (required for HTTP calls from DB)
SELECT 
  'pg_net Extension' as check_type,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ Enabled'
    ELSE '❌ Not Enabled - Run: CREATE EXTENSION IF NOT EXISTS pg_net;'
  END as status
FROM pg_extension 
WHERE extname = 'pg_net';

-- 3. Enable pg_net if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 4. Set the database configuration variables
-- REPLACE THESE VALUES WITH YOUR ACTUAL SUPABASE PROJECT VALUES!

-- Get your values from:
-- Supabase Dashboard → Settings → API
-- - Project URL: https://YOUR_PROJECT_REF.supabase.co
-- - Anon Key: Your anon/public key (starts with eyJ...)

-- UNCOMMENT AND UPDATE THESE LINES WITH YOUR ACTUAL VALUES:
-- ALTER DATABASE postgres SET app.supabase_url = 'https://utafetamgwukkbrlezev.supabase.co';
-- ALTER DATABASE postgres SET app.supabase_anon_key = 'YOUR_ACTUAL_ANON_KEY_HERE';

-- 5. Verify settings after you update them
SELECT 
  'Verification After Update' as check_type,
  name, 
  setting,
  CASE 
    WHEN setting IS NULL OR setting = '' THEN '❌ STILL NOT SET - UPDATE ABOVE!'
    WHEN setting LIKE '%YOUR_%' THEN '⚠️ PLACEHOLDER - UPDATE WITH REAL VALUES!'
    ELSE '✅ LOOKS GOOD'
  END as status
FROM pg_settings 
WHERE name IN ('app.supabase_url', 'app.supabase_anon_key');

-- 6. Test the trigger manually for testingauto
DO $$
DECLARE
  testing_talent_id UUID;
  talent_user_id UUID;
  talent_phone TEXT;
  sms_enabled BOOLEAN;
BEGIN
  -- Get testingauto details
  SELECT id, user_id INTO testing_talent_id, talent_user_id
  FROM talent_profiles
  WHERE full_name ILIKE '%testingauto%'
  LIMIT 1;
  
  IF testing_talent_id IS NOT NULL THEN
    -- Get phone number
    SELECT phone INTO talent_phone
    FROM users
    WHERE id = talent_user_id;
    
    -- Check SMS settings
    SELECT notification_settings.sms_enabled INTO sms_enabled
    FROM notification_settings
    WHERE notification_type = 'talent_new_order';
    
    RAISE NOTICE '=== SMS TEST INFO ===';
    RAISE NOTICE 'Talent ID: %', testing_talent_id;
    RAISE NOTICE 'User ID: %', talent_user_id;
    RAISE NOTICE 'Phone: %', COALESCE(talent_phone, 'NULL - NO PHONE!');
    RAISE NOTICE 'SMS Enabled: %', COALESCE(sms_enabled::text, 'NULL - NOT CONFIGURED!');
    RAISE NOTICE '';
    
    IF talent_phone IS NULL THEN
      RAISE NOTICE '❌ PROBLEM: No phone number for testingauto!';
    ELSIF sms_enabled IS NULL OR sms_enabled = false THEN
      RAISE NOTICE '❌ PROBLEM: SMS not enabled for talent_new_order!';
    ELSE
      RAISE NOTICE '✅ Phone and SMS settings look good!';
      RAISE NOTICE 'If SMS still not working, check:';
      RAISE NOTICE '  1. Database config (app.supabase_url, app.supabase_anon_key)';
      RAISE NOTICE '  2. send-sms Edge Function logs';
      RAISE NOTICE '  3. Twilio credentials in Edge Function';
    END IF;
  ELSE
    RAISE NOTICE '❌ testingauto talent not found!';
  END IF;
END $$;


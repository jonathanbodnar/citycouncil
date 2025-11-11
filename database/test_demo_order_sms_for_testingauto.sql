-- Test SMS notification for testingauto's demo order

-- 1. First, verify pg_net is enabled
SELECT 
  '1. pg_net Extension Check' as step,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ Enabled'
    ELSE '❌ Not Enabled'
  END as status
FROM pg_extension 
WHERE extname = 'pg_net';

-- 2. Check database config
SELECT 
  '2. Database Config Check' as step,
  name, 
  CASE 
    WHEN setting IS NULL OR setting = '' THEN '❌ NOT SET'
    WHEN setting LIKE '%YOUR_%' THEN '⚠️ PLACEHOLDER'
    ELSE '✅ SET'
  END as status
FROM pg_settings 
WHERE name IN ('app.supabase_url', 'app.supabase_anon_key');

-- 3. Check testingauto has phone number
SELECT 
  '3. Testingauto Phone Check' as step,
  u.phone,
  CASE 
    WHEN u.phone IS NULL THEN '❌ NO PHONE'
    ELSE '✅ Has Phone: ' || u.phone
  END as status
FROM users u
JOIN talent_profiles tp ON tp.user_id = u.id
WHERE tp.full_name ILIKE '%testingauto%';

-- 4. Check SMS is enabled
SELECT 
  '4. SMS Settings Check' as step,
  notification_type,
  sms_enabled,
  CASE 
    WHEN sms_enabled = true THEN '✅ SMS Enabled'
    ELSE '❌ SMS Disabled'
  END as status
FROM notification_settings
WHERE notification_type = 'talent_new_order';

-- 5. Get testingauto's demo order details
SELECT 
  '5. Demo Order Details' as step,
  o.id as order_id,
  o.payment_transaction_id,
  o.order_type,
  tp.full_name as talent_name,
  u.phone as talent_phone
FROM orders o
JOIN talent_profiles tp ON tp.id = o.talent_id
JOIN users u ON u.id = tp.user_id
WHERE tp.full_name ILIKE '%testingauto%'
AND o.order_type = 'demo'
ORDER BY o.created_at DESC
LIMIT 1;

-- 6. Manually trigger SMS notification for testingauto
DO $$
DECLARE
  talent_user_id UUID;
  talent_phone TEXT;
  sms_enabled BOOLEAN;
  demo_order_id UUID;
BEGIN
  -- Get testingauto details
  SELECT u.id, u.phone INTO talent_user_id, talent_phone
  FROM users u
  JOIN talent_profiles tp ON tp.user_id = u.id
  WHERE tp.full_name ILIKE '%testingauto%'
  LIMIT 1;
  
  -- Get demo order
  SELECT o.id INTO demo_order_id
  FROM orders o
  JOIN talent_profiles tp ON tp.id = o.talent_id
  WHERE tp.full_name ILIKE '%testingauto%'
  AND o.order_type = 'demo'
  ORDER BY o.created_at DESC
  LIMIT 1;
  
  -- Check SMS settings
  SELECT notification_settings.sms_enabled INTO sms_enabled
  FROM notification_settings
  WHERE notification_type = 'talent_new_order';
  
  RAISE NOTICE '=== SMS TEST ===';
  RAISE NOTICE 'Talent User ID: %', talent_user_id;
  RAISE NOTICE 'Talent Phone: %', talent_phone;
  RAISE NOTICE 'SMS Enabled: %', sms_enabled;
  RAISE NOTICE 'Demo Order ID: %', demo_order_id;
  
  IF talent_phone IS NULL THEN
    RAISE NOTICE '❌ BLOCKED: No phone number for testingauto!';
  ELSIF sms_enabled IS NULL OR sms_enabled = false THEN
    RAISE NOTICE '❌ BLOCKED: SMS not enabled for talent_new_order!';
  ELSIF demo_order_id IS NULL THEN
    RAISE NOTICE '❌ BLOCKED: No demo order found for testingauto!';
  ELSE
    -- Try to send SMS via Edge Function
    BEGIN
      RAISE NOTICE '📱 Attempting to send SMS...';
      
      PERFORM net.http_post(
        url := current_setting('app.supabase_url', true) || '/functions/v1/send-sms',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key', true)
        ),
        body := jsonb_build_object(
          'to', talent_phone,
          'message', 'TEST: New demo ShoutOut order! Check your dashboard: https://shoutout.us/orders'
        )::text
      );
      
      RAISE NOTICE '✅ SMS request sent successfully!';
      RAISE NOTICE '';
      RAISE NOTICE 'Check:';
      RAISE NOTICE '  1. Your phone for the SMS';
      RAISE NOTICE '  2. Supabase Edge Functions → send-sms → Logs';
      RAISE NOTICE '  3. Twilio logs if no SMS received';
      
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE '❌ SMS send failed: %', SQLERRM;
        RAISE NOTICE '';
        RAISE NOTICE 'Possible issues:';
        RAISE NOTICE '  1. Database config not set (app.supabase_url, app.supabase_anon_key)';
        RAISE NOTICE '  2. send-sms Edge Function not deployed';
        RAISE NOTICE '  3. Twilio credentials not configured in Edge Function';
    END;
  END IF;
END $$;

-- 7. Show final status
SELECT 
  '7. Final Status' as step,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net')
         AND EXISTS (SELECT 1 FROM pg_settings WHERE name = 'app.supabase_url' AND setting IS NOT NULL AND setting != '')
         AND EXISTS (SELECT 1 FROM notification_settings WHERE notification_type = 'talent_new_order' AND sms_enabled = true)
         AND EXISTS (
           SELECT 1 FROM users u
           JOIN talent_profiles tp ON tp.user_id = u.id
           WHERE tp.full_name ILIKE '%testingauto%' AND u.phone IS NOT NULL
         )
    THEN '✅ All checks passed - SMS should have been sent!'
    ELSE '⚠️ Some checks failed - see messages above'
  END as status;


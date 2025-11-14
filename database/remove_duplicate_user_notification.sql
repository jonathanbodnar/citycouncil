-- Remove duplicate user order notification setting
-- We have two: "user_order_delivered" and "user_order_completed"
-- Keep "user_order_completed" (the active one), remove "user_order_delivered"

-- 1. Show current notification settings for user order completion
SELECT 
  '🔍 CURRENT USER ORDER NOTIFICATIONS' as check,
  notification_type,
  display_name,
  description,
  sms_enabled,
  email_enabled,
  in_app_enabled,
  sms_template,
  created_at
FROM notification_settings
WHERE notification_type IN ('user_order_delivered', 'user_order_completed')
ORDER BY created_at;

-- 2. Check which one is actually being used in the code/triggers
-- Look for any references in the database
SELECT 
  '🔧 CHECKING DATABASE TRIGGERS' as check,
  routine_name,
  routine_type,
  routine_definition
FROM information_schema.routines
WHERE routine_definition LIKE '%user_order_delivered%'
   OR routine_definition LIKE '%user_order_completed%';

-- 3. Check notification logs to see which type is being used
SELECT 
  '📊 NOTIFICATION HISTORY CHECK' as check,
  'user_order_delivered' as notification_type,
  COUNT(*) as times_used,
  MAX(created_at) as last_used
FROM notifications
WHERE type = 'user_order_delivered'
UNION ALL
SELECT 
  '📊 NOTIFICATION HISTORY CHECK' as check,
  'user_order_completed' as notification_type,
  COUNT(*) as times_used,
  MAX(created_at) as last_used
FROM notifications
WHERE type = 'user_order_completed';

-- 4. Decision: Remove "user_order_delivered" (OLD)
-- Keep "user_order_completed" (NEW/ACTIVE)
DELETE FROM notification_settings
WHERE notification_type = 'user_order_delivered';

-- 5. Verify the duplicate is removed
SELECT 
  '✅ AFTER CLEANUP' as result,
  notification_type,
  display_name,
  description,
  sms_enabled,
  email_enabled,
  in_app_enabled
FROM notification_settings
WHERE notification_type LIKE '%user%order%'
ORDER BY notification_type;

-- 6. Show all remaining notification settings for review
SELECT 
  '📋 ALL NOTIFICATION SETTINGS' as info,
  notification_type,
  display_name,
  sms_enabled,
  email_enabled,
  in_app_enabled
FROM notification_settings
ORDER BY 
  CASE 
    WHEN notification_type LIKE 'talent%' THEN 1
    WHEN notification_type LIKE 'user%' THEN 2
    ELSE 3
  END,
  notification_type;


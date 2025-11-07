-- Quick diagnostic to verify everything is set up for two-way SMS

-- =============================================================================
-- STEP 1: Check if talent has phone number in users table
-- =============================================================================

SELECT 
  '1. TALENT PHONE NUMBERS IN USERS TABLE' as check_name,
  tp.temp_full_name as talent_name,
  tp.username,
  u.phone,
  CASE 
    WHEN u.phone IS NOT NULL THEN '✅ Phone exists'
    ELSE '❌ No phone - cannot receive SMS'
  END as status
FROM talent_profiles tp
INNER JOIN users u ON tp.user_id = u.id
WHERE tp.is_active = true
ORDER BY 
  CASE WHEN u.phone IS NOT NULL THEN 0 ELSE 1 END,
  tp.temp_full_name;

-- =============================================================================
-- STEP 2: Check sms_messages table exists and has correct schema
-- =============================================================================

SELECT 
  '2. SMS_MESSAGES TABLE CHECK' as check_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'sms_messages'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- =============================================================================
-- STEP 3: Check existing messages in sms_messages
-- =============================================================================

SELECT 
  '3. EXISTING SMS MESSAGES' as check_name,
  COUNT(*) as total_messages,
  SUM(CASE WHEN from_admin = true THEN 1 ELSE 0 END) as admin_messages,
  SUM(CASE WHEN from_admin = false THEN 1 ELSE 0 END) as talent_replies
FROM sms_messages;

-- Show recent messages
SELECT 
  '3A. RECENT MESSAGES' as check_name,
  sm.id,
  tp.temp_full_name as talent_name,
  sm.from_admin,
  LEFT(sm.message, 50) as message_preview,
  sm.sent_at
FROM sms_messages sm
INNER JOIN talent_profiles tp ON sm.talent_id = tp.id
ORDER BY sm.sent_at DESC
LIMIT 10;

-- =============================================================================
-- STEP 4: Test if we can manually insert a message (simulate Twilio webhook)
-- =============================================================================

-- Get a talent_id to test with
SELECT 
  '4. TALENT FOR TESTING' as check_name,
  tp.id as talent_id,
  tp.temp_full_name as talent_name,
  u.phone
FROM talent_profiles tp
INNER JOIN users u ON tp.user_id = u.id
WHERE u.phone IS NOT NULL
LIMIT 1;

-- =============================================================================
-- DIAGNOSTIC SUMMARY
-- =============================================================================

SELECT '
🔍 DIAGNOSTIC CHECKLIST

If receive-sms is deployed but no logs:

1. ❓ Is Twilio webhook URL correct?
   Go to: https://console.twilio.com/us1/develop/phone-numbers/manage/incoming
   Should be: https://utafetamgwukkbrlezev.supabase.co/functions/v1/receive-sms?apikey=ANON_KEY
   
2. ❓ Did you click SAVE in Twilio after setting webhook?
   Common mistake: setting URL but not saving
   
3. ❓ Are you replying from the correct phone number?
   Twilio only accepts replies to messages it sent
   
4. ❓ Is the Twilio phone number correct?
   Check which number sent the original message
   
5. ❓ Check Twilio debugger logs:
   https://console.twilio.com/us1/monitor/logs/debugger
   Look for incoming message webhook calls
   
6. ❓ Is webhook set for the RIGHT phone number?
   If you have multiple Twilio numbers, check each one
   
7. ❓ Is Method set to HTTP POST?
   Should be POST, not GET

NEXT STEPS:
1. Check Twilio Console → Phone Numbers → Active Numbers
2. Click your phone number
3. Screenshot the "Messaging" section
4. Share screenshot to verify configuration

' as diagnostic_summary;


-- Check if admin panel email templates match what cron job will send

-- 1. Show ALL email flows with message counts
SELECT 
  f.id,
  f.name,
  f.display_name,
  f.is_active,
  COUNT(m.id) as message_count,
  CASE 
    WHEN COUNT(m.id) = 0 THEN '❌ NO MESSAGES'
    WHEN f.is_active = false THEN '⚠️ FLOW DISABLED'
    ELSE '✅ READY'
  END as status
FROM email_flows f
LEFT JOIN email_flow_messages m ON m.flow_id = f.id AND m.is_active = true
GROUP BY f.id, f.name, f.display_name, f.is_active
ORDER BY f.name;

-- 2. Show talent connection flow messages (what admin panel shows)
SELECT 
  '🎨 TALENT CONNECTION FLOW' as section,
  sequence_order,
  LEFT(subject, 60) as subject,
  delay_minutes,
  delay_hours,
  delay_days,
  is_active
FROM email_flow_messages
WHERE flow_id = 'aaaa1111-1111-1111-1111-111111111111'
ORDER BY sequence_order;

-- 3. Show post-purchase flow messages
SELECT 
  '🛒 POST-PURCHASE FLOW' as section,
  sequence_order,
  LEFT(subject, 60) as subject,
  delay_minutes,
  delay_hours,
  delay_days,
  is_active
FROM email_flow_messages
WHERE flow_id = 'bbbb5555-5555-5555-5555-555555555555'
ORDER BY sequence_order;

-- 4. Show giveaway welcome flow messages
SELECT 
  '🎁 GIVEAWAY WELCOME FLOW' as section,
  sequence_order,
  LEFT(subject, 60) as subject,
  delay_minutes,
  delay_hours,
  delay_days,
  is_active
FROM email_flow_messages
WHERE flow_id = 'aaaa2222-2222-2222-2222-222222222222'
ORDER BY sequence_order;

-- 5. Check what the cron job will actually send
SELECT 
  '📧 EMAILS READY TO SEND' as section,
  uef.email,
  f.name as flow_name,
  uef.current_message_order,
  uef.next_email_scheduled_at,
  CASE 
    WHEN uef.next_email_scheduled_at <= NOW() THEN '🟢 DUE NOW'
    ELSE '🟡 SCHEDULED FOR ' || to_char(uef.next_email_scheduled_at, 'Mon DD HH24:MI')
  END as send_status,
  m.subject as next_email_subject
FROM user_email_flow_status uef
JOIN email_flows f ON f.id = uef.flow_id
LEFT JOIN email_flow_messages m ON m.flow_id = uef.flow_id 
  AND m.sequence_order = (uef.current_message_order + 1)
  AND m.is_active = true
WHERE uef.flow_completed_at IS NULL
  AND uef.is_paused = false
  AND uef.unsubscribed = false
ORDER BY uef.next_email_scheduled_at
LIMIT 20;

-- 6. Summary
DO $$
DECLARE
  v_talent_conn_msgs INT;
  v_post_purchase_msgs INT;
  v_ready_to_send INT;
BEGIN
  SELECT COUNT(*) INTO v_talent_conn_msgs 
  FROM email_flow_messages 
  WHERE flow_id = 'aaaa1111-1111-1111-1111-111111111111' AND is_active = true;
  
  SELECT COUNT(*) INTO v_post_purchase_msgs 
  FROM email_flow_messages 
  WHERE flow_id = 'bbbb5555-5555-5555-5555-555555555555' AND is_active = true;
  
  SELECT COUNT(*) INTO v_ready_to_send 
  FROM user_email_flow_status 
  WHERE next_email_scheduled_at <= NOW() 
    AND flow_completed_at IS NULL 
    AND is_paused = false;
  
  RAISE NOTICE '';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'SUMMARY';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Talent Connection Flow: % messages', v_talent_conn_msgs;
  RAISE NOTICE 'Post-Purchase Flow: % messages', v_post_purchase_msgs;
  RAISE NOTICE '';
  RAISE NOTICE 'Emails ready to send RIGHT NOW: %', v_ready_to_send;
  RAISE NOTICE '';
  
  IF v_talent_conn_msgs = 0 THEN
    RAISE NOTICE '❌ PROBLEM: Talent connection flow has NO messages!';
    RAISE NOTICE '   Solution: Run migrations/20250112_talent_connection_email_flow.sql';
  END IF;
  
  IF v_post_purchase_msgs = 0 THEN
    RAISE NOTICE '❌ PROBLEM: Post-purchase flow has NO messages!';
    RAISE NOTICE '   Solution: Run FIX_ALL_EMAIL_FLOWS.sql';
  END IF;
  
  IF v_ready_to_send > 0 THEN
    RAISE NOTICE '✅ There are % emails waiting to be sent', v_ready_to_send;
    RAISE NOTICE '   They will send when cron job next runs (every 5 minutes)';
  ELSE
    RAISE NOTICE 'ℹ️ No emails are due to send right now';
  END IF;
  
  RAISE NOTICE '';
END $$;


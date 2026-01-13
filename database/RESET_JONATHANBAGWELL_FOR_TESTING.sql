-- Reset jonathanbagwell23@gmail.com for email flow testing
-- This removes email flow enrollments so they can be re-enrolled

-- Remove from all email flows
DELETE FROM user_email_flow_status 
WHERE email = 'jonathanbagwell23@gmail.com';

-- Remove email send logs
DELETE FROM email_send_log 
WHERE email = 'jonathanbagwell23@gmail.com';

-- Verify deletion
SELECT 
  'Email Flow Status' as table_name,
  COUNT(*) as remaining_records
FROM user_email_flow_status 
WHERE email = 'jonathanbagwell23@gmail.com'
UNION ALL
SELECT 
  'Email Send Log',
  COUNT(*)
FROM email_send_log 
WHERE email = 'jonathanbagwell23@gmail.com';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ jonathanbagwell23@gmail.com reset successfully';
  RAISE NOTICE '   - Email flow enrollments: REMOVED';
  RAISE NOTICE '   - Email send logs: CLEARED';
  RAISE NOTICE '';
  RAISE NOTICE 'Ready to test! User can now:';
  RAISE NOTICE '1. Subscribe to a talent on bio page';
  RAISE NOTICE '2. Receive welcome email via cron job';
END $$;


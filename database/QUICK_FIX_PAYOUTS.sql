-- Quick fix for common payout issues
-- Run this if payouts aren't processing automatically

BEGIN;

-- 1. Make sure payouts are enabled
UPDATE platform_settings
SET setting_value = 'true'
WHERE setting_key = 'payouts_enabled';

-- 2. Make sure cron job is active
SELECT cron.alter_job(
  jobid,
  active := true
)
FROM cron.job
WHERE jobname LIKE '%payout%';

-- 3. Try to process payouts immediately
SELECT invoke_process_payouts();

COMMIT;

-- Show results
SELECT 
  '✅ QUICK FIX APPLIED' as status,
  'Payouts enabled, cron activated, and manual trigger attempted' as action;

-- Check if it worked
SELECT 
  'Results' as section,
  COUNT(*) FILTER (WHERE status = 'pending') as still_pending_batches,
  COUNT(*) FILTER (WHERE status = 'processing') as now_processing,
  COUNT(*) FILTER (WHERE status = 'paid') as completed_today,
  COALESCE(SUM(net_payout_amount) FILTER (WHERE status = 'pending'), 0) as still_pending_amount
FROM payout_batches
WHERE created_at > NOW() - INTERVAL '7 days';

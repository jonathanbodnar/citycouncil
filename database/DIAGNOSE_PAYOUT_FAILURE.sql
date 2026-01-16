-- Comprehensive diagnosis of why payouts aren't processing
-- Run this to find out what's blocking automatic payouts

-- 1. Check if there are any pending batches
SELECT 
  '🔴 PENDING PAYOUT BATCHES' as section,
  pb.id,
  tp.username as talent,
  COALESCE(tp.temp_full_name, tp.username) as talent_name,
  pb.week_start_date,
  pb.week_end_date,
  pb.total_orders,
  pb.net_payout_amount,
  pb.status,
  pb.needs_review,
  pb.review_reason,
  pb.created_at,
  -- Show WHY this batch isn't processing
  CASE 
    WHEN pb.needs_review THEN '🔍 Needs Manual Review: ' || pb.review_reason
    WHEN tp.moov_account_id IS NULL THEN '❌ No Moov Account'
    WHEN NOT tp.bank_account_linked THEN '❌ Bank Not Linked'
    WHEN NOT tp.payout_onboarding_completed THEN '❌ Onboarding Incomplete'
    ELSE '✅ Ready to Process'
  END as blocking_reason
FROM payout_batches pb
JOIN talent_profiles tp ON tp.id = pb.talent_id
WHERE pb.status = 'pending'
ORDER BY pb.created_at DESC;

-- 2. Check platform settings
SELECT 
  '⚙️ PLATFORM SETTINGS' as section,
  setting_key,
  setting_value,
  CASE 
    WHEN setting_key = 'payouts_enabled' AND setting_value = 'true' THEN '✅ ENABLED'
    WHEN setting_key = 'payouts_enabled' AND setting_value = 'false' THEN '❌ DISABLED - THIS IS WHY PAYOUTS AREN''T RUNNING!'
    ELSE setting_value
  END as status
FROM platform_settings
WHERE setting_key = 'payouts_enabled';

-- 3. Check if cron job exists and is active
SELECT 
  '⏰ CRON JOBS' as section,
  jobid,
  jobname,
  schedule,
  active,
  CASE 
    WHEN active THEN '✅ ACTIVE'
    ELSE '❌ INACTIVE - THIS IS WHY PAYOUTS AREN''T RUNNING!'
  END as status,
  command
FROM cron.job
WHERE jobname LIKE '%payout%';

-- 4. Check if invoke_process_payouts function exists
SELECT 
  '🔧 REQUIRED FUNCTIONS' as section,
  'invoke_process_payouts' as function_name,
  CASE 
    WHEN EXISTS(
      SELECT 1 FROM pg_proc WHERE proname = 'invoke_process_payouts'
    ) THEN '✅ EXISTS'
    ELSE '❌ MISSING - THIS IS WHY PAYOUTS AREN''T RUNNING!'
  END as status;

-- 5. Check talent readiness breakdown
SELECT 
  '👤 TALENT READINESS BREAKDOWN' as section,
  COUNT(*) FILTER (WHERE tp.moov_account_id IS NOT NULL 
    AND tp.bank_account_linked 
    AND tp.payout_onboarding_completed) as ready_talent,
  COUNT(*) FILTER (WHERE tp.moov_account_id IS NULL) as no_moov_account,
  COUNT(*) FILTER (WHERE tp.moov_account_id IS NOT NULL 
    AND NOT tp.bank_account_linked) as no_bank_linked,
  COUNT(*) FILTER (WHERE tp.moov_account_id IS NOT NULL 
    AND NOT tp.payout_onboarding_completed) as incomplete_onboarding,
  COUNT(*) as total_with_pending_batches
FROM talent_profiles tp
WHERE EXISTS(
  SELECT 1 FROM payout_batches pb 
  WHERE pb.talent_id = tp.id AND pb.status = 'pending'
);

-- 6. Show which specific talent have pending batches and their blocking reason
SELECT 
  '🚫 BLOCKING ISSUES BY TALENT' as section,
  tp.username,
  COALESCE(tp.temp_full_name, tp.username) as talent_name,
  COUNT(pb.id) as pending_batches,
  SUM(pb.net_payout_amount) as total_pending,
  CASE 
    WHEN tp.moov_account_id IS NULL THEN '❌ NO MOOV ACCOUNT'
    WHEN NOT tp.bank_account_linked THEN '❌ BANK NOT LINKED'
    WHEN NOT tp.payout_onboarding_completed THEN '❌ ONBOARDING INCOMPLETE'
    WHEN EXISTS(
      SELECT 1 FROM payout_batches 
      WHERE talent_id = tp.id 
      AND status = 'pending' 
      AND needs_review = true
    ) THEN '🔍 NEEDS MANUAL REVIEW'
    ELSE '✅ READY (should have been processed)'
  END as status
FROM talent_profiles tp
JOIN payout_batches pb ON pb.talent_id = tp.id
WHERE pb.status = 'pending'
GROUP BY tp.id, tp.username, tp.temp_full_name, tp.moov_account_id, tp.bank_account_linked, tp.payout_onboarding_completed
ORDER BY total_pending DESC;

-- 7. Summary with clear action items
DO $$
DECLARE
  v_pending_batches INT;
  v_total_pending_amount DECIMAL;
  v_payouts_enabled BOOLEAN;
  v_cron_exists BOOLEAN;
  v_cron_active BOOLEAN;
  v_function_exists BOOLEAN;
  v_ready_talent INT;
  v_blocked_talent INT;
  v_batches_needing_review INT;
BEGIN
  -- Count pending batches
  SELECT COUNT(*), COALESCE(SUM(net_payout_amount), 0)
  INTO v_pending_batches, v_total_pending_amount
  FROM payout_batches
  WHERE status = 'pending';
  
  -- Count batches needing review
  SELECT COUNT(*) INTO v_batches_needing_review
  FROM payout_batches
  WHERE status = 'pending' AND needs_review = true;
  
  -- Check if payouts are enabled
  SELECT COALESCE(setting_value::BOOLEAN, false) INTO v_payouts_enabled
  FROM platform_settings
  WHERE setting_key = 'payouts_enabled';
  
  -- Check if cron exists and is active
  SELECT 
    EXISTS(SELECT 1 FROM cron.job WHERE jobname LIKE '%payout%'),
    COALESCE(MAX(active), false)
  INTO v_cron_exists, v_cron_active
  FROM cron.job
  WHERE jobname LIKE '%payout%';
  
  -- Check if function exists
  SELECT EXISTS(
    SELECT 1 FROM pg_proc WHERE proname = 'invoke_process_payouts'
  ) INTO v_function_exists;
  
  -- Count talent ready for payouts
  SELECT COUNT(*) INTO v_ready_talent
  FROM talent_profiles tp
  WHERE moov_account_id IS NOT NULL
    AND bank_account_linked = true
    AND payout_onboarding_completed = true
    AND EXISTS(
      SELECT 1 FROM payout_batches pb
      WHERE pb.talent_id = tp.id AND pb.status = 'pending'
    );
    
  -- Count blocked talent
  SELECT COUNT(DISTINCT tp.id) INTO v_blocked_talent
  FROM talent_profiles tp
  JOIN payout_batches pb ON pb.talent_id = tp.id
  WHERE pb.status = 'pending'
    AND (tp.moov_account_id IS NULL 
      OR NOT tp.bank_account_linked 
      OR NOT tp.payout_onboarding_completed);
  
  RAISE NOTICE '';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '💰 PAYOUT FAILURE DIAGNOSIS';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Total Pending Batches: %', v_pending_batches;
  RAISE NOTICE 'Total Pending Amount: $%', v_total_pending_amount;
  RAISE NOTICE 'Batches Needing Review (>$1000): %', v_batches_needing_review;
  RAISE NOTICE 'Talent Ready to Be Paid: %', v_ready_talent;
  RAISE NOTICE 'Talent Blocked (incomplete setup): %', v_blocked_talent;
  RAISE NOTICE '';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '🔍 SYSTEM STATUS:';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '';
  RAISE NOTICE '1. Payouts Enabled: %', CASE WHEN v_payouts_enabled THEN '✅ YES' ELSE '❌ NO' END;
  RAISE NOTICE '2. Cron Job Exists: %', CASE WHEN v_cron_exists THEN '✅ YES' ELSE '❌ NO' END;
  RAISE NOTICE '3. Cron Job Active: %', CASE WHEN v_cron_active THEN '✅ YES' ELSE '❌ NO' END;
  RAISE NOTICE '4. Function Exists: %', CASE WHEN v_function_exists THEN '✅ YES' ELSE '❌ NO' END;
  RAISE NOTICE '';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '🔧 ROOT CAUSE & SOLUTION:';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '';
  
  -- Identify the root cause
  IF NOT v_payouts_enabled THEN
    RAISE NOTICE '❌ CRITICAL: Payouts are DISABLED in platform settings!';
    RAISE NOTICE '   This is likely the main reason payouts didn''t run.';
    RAISE NOTICE '';
    RAISE NOTICE '   SOLUTION:';
    RAISE NOTICE '   Run this SQL command:';
    RAISE NOTICE '   UPDATE platform_settings SET setting_value = ''true'' WHERE setting_key = ''payouts_enabled'';';
    RAISE NOTICE '';
  ELSIF NOT v_cron_exists THEN
    RAISE NOTICE '❌ CRITICAL: No automatic payout cron job exists!';
    RAISE NOTICE '';
    RAISE NOTICE '   SOLUTION:';
    RAISE NOTICE '   Run database/FIX_PAYOUT_AUTOMATION.sql to set up the cron job.';
    RAISE NOTICE '';
  ELSIF NOT v_cron_active THEN
    RAISE NOTICE '❌ CRITICAL: Payout cron job exists but is INACTIVE!';
    RAISE NOTICE '';
    RAISE NOTICE '   SOLUTION:';
    RAISE NOTICE '   SELECT cron.alter_job(jobid, active := true) FROM cron.job WHERE jobname LIKE ''%payout%'';';
    RAISE NOTICE '';
  ELSIF NOT v_function_exists THEN
    RAISE NOTICE '❌ CRITICAL: invoke_process_payouts function is missing!';
    RAISE NOTICE '';
    RAISE NOTICE '   SOLUTION:';
    RAISE NOTICE '   Run database/FIX_PAYOUT_AUTOMATION.sql to recreate the function.';
    RAISE NOTICE '';
  ELSIF v_ready_talent = 0 AND v_blocked_talent > 0 THEN
    RAISE NOTICE '⚠️  WARNING: All talent with pending batches have incomplete payout setup!';
    RAISE NOTICE '   % talent need to complete payout onboarding.', v_blocked_talent;
    RAISE NOTICE '';
    RAISE NOTICE '   SOLUTION:';
    RAISE NOTICE '   Contact each talent to complete their payout setup:';
    RAISE NOTICE '   - Moov account creation';
    RAISE NOTICE '   - Bank account linking';
    RAISE NOTICE '   - Complete onboarding flow';
    RAISE NOTICE '';
  ELSIF v_batches_needing_review > 0 THEN
    RAISE NOTICE '🔍 INFO: % batch(es) need manual review (amounts over $1000)', v_batches_needing_review;
    RAISE NOTICE '';
    RAISE NOTICE '   SOLUTION:';
    RAISE NOTICE '   Go to Admin > Payouts and manually approve these batches.';
    RAISE NOTICE '';
  ELSE
    RAISE NOTICE '⚠️  UNKNOWN ISSUE: Everything appears configured correctly but payouts didn''t run.';
    RAISE NOTICE '';
    RAISE NOTICE '   POSSIBLE CAUSES:';
    RAISE NOTICE '   1. Edge function (moov-process-pending-batches) might be failing';
    RAISE NOTICE '   2. Service role key might be incorrect';
    RAISE NOTICE '   3. Moov API might be down or returning errors';
    RAISE NOTICE '';
    RAISE NOTICE '   SOLUTION:';
    RAISE NOTICE '   1. Check Railway logs for edge function errors';
    RAISE NOTICE '   2. Try manually triggering: SELECT invoke_process_payouts();';
    RAISE NOTICE '   3. Check Moov dashboard for API errors';
    RAISE NOTICE '';
  END IF;
  
  IF v_ready_talent > 0 THEN
    RAISE NOTICE '💡 TIP: To process % ready batch(es) immediately, run:', v_ready_talent;
    RAISE NOTICE '   SELECT invoke_process_payouts();';
    RAISE NOTICE '';
  END IF;
  
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '';
END $$;

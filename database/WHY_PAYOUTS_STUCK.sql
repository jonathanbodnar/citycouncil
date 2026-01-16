-- Detailed check: WHY are payouts still stuck?

-- Show each pending batch with detailed blocking reason
SELECT 
  '🔍 DETAILED BATCH ANALYSIS' as section,
  pb.id as batch_id,
  tp.username as talent,
  COALESCE(tp.temp_full_name, tp.username) as talent_name,
  pb.net_payout_amount as amount,
  pb.needs_review,
  pb.review_reason,
  pb.created_at,
  -- Moov setup status
  tp.moov_account_id as moov_id,
  tp.bank_account_linked,
  tp.payout_onboarding_completed,
  -- What's blocking THIS specific batch?
  CASE 
    WHEN pb.needs_review = true THEN '🔍 NEEDS MANUAL REVIEW: ' || COALESCE(pb.review_reason, 'Amount over $1000')
    WHEN tp.moov_account_id IS NULL THEN '❌ TALENT HAS NO MOOV ACCOUNT'
    WHEN tp.bank_account_linked = false THEN '❌ TALENT BANK NOT LINKED'
    WHEN tp.payout_onboarding_completed = false THEN '❌ TALENT ONBOARDING INCOMPLETE'
    WHEN pb.net_payout_amount <= 0 THEN '❌ INVALID AMOUNT (zero or negative)'
    ELSE '✅ READY - Should have been processed!'
  END as blocking_reason,
  -- Show exact onboarding step they're on
  tp.payout_onboarding_step as onboarding_step
FROM payout_batches pb
JOIN talent_profiles tp ON tp.id = pb.talent_id
WHERE pb.status = 'pending'
ORDER BY pb.net_payout_amount DESC;

-- Check if invoke_process_payouts function exists and works
DO $$
DECLARE
  v_function_exists BOOLEAN;
  v_error_message TEXT;
BEGIN
  -- Check if function exists
  SELECT EXISTS(
    SELECT 1 FROM pg_proc WHERE proname = 'invoke_process_payouts'
  ) INTO v_function_exists;
  
  RAISE NOTICE '';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '🔧 FUNCTION CHECK';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '';
  
  IF v_function_exists THEN
    RAISE NOTICE '✅ invoke_process_payouts() function EXISTS';
    RAISE NOTICE '';
    RAISE NOTICE 'Attempting to call it now...';
    
    BEGIN
      -- Try to call it
      PERFORM invoke_process_payouts();
      RAISE NOTICE '✅ Function executed without error';
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_error_message = MESSAGE_TEXT;
      RAISE NOTICE '❌ Function FAILED with error: %', v_error_message;
    END;
  ELSE
    RAISE NOTICE '❌ invoke_process_payouts() function DOES NOT EXIST!';
    RAISE NOTICE '';
    RAISE NOTICE 'SOLUTION: Run database/FIX_PAYOUT_AUTOMATION.sql';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '';
END $$;

-- Check platform settings
SELECT 
  '⚙️ SETTINGS CHECK' as section,
  setting_key,
  setting_value,
  CASE 
    WHEN setting_key = 'payouts_enabled' AND setting_value = 'true' THEN '✅ Enabled'
    WHEN setting_key = 'payouts_enabled' THEN '❌ DISABLED - this blocks payouts!'
    ELSE setting_value
  END as status
FROM platform_settings
WHERE setting_key = 'payouts_enabled';

-- Show cron job status
SELECT 
  '⏰ CRON JOB CHECK' as section,
  jobname,
  schedule,
  active,
  CASE 
    WHEN active THEN '✅ Active'
    ELSE '❌ INACTIVE - this blocks payouts!'
  END as status,
  command
FROM cron.job
WHERE jobname LIKE '%payout%';

-- Count breakdown
SELECT 
  '📊 SUMMARY' as section,
  COUNT(*) as total_pending_batches,
  SUM(pb.net_payout_amount) as total_amount,
  COUNT(*) FILTER (WHERE pb.needs_review = true) as needs_review,
  COUNT(*) FILTER (WHERE tp.moov_account_id IS NULL) as no_moov_account,
  COUNT(*) FILTER (WHERE tp.moov_account_id IS NOT NULL AND tp.bank_account_linked = false) as moov_but_no_bank,
  COUNT(*) FILTER (WHERE tp.moov_account_id IS NOT NULL AND tp.payout_onboarding_completed = false) as moov_but_incomplete,
  COUNT(*) FILTER (
    WHERE tp.moov_account_id IS NOT NULL 
    AND tp.bank_account_linked = true 
    AND tp.payout_onboarding_completed = true
    AND (pb.needs_review = false OR pb.needs_review IS NULL)
  ) as ready_to_process
FROM payout_batches pb
JOIN talent_profiles tp ON tp.id = pb.talent_id
WHERE pb.status = 'pending';

-- Final diagnosis
DO $$
DECLARE
  v_total_pending INT;
  v_ready_count INT;
  v_needs_review INT;
  v_no_moov INT;
  v_incomplete INT;
BEGIN
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (
      WHERE tp.moov_account_id IS NOT NULL 
      AND tp.bank_account_linked = true 
      AND tp.payout_onboarding_completed = true
      AND (pb.needs_review = false OR pb.needs_review IS NULL)
    ),
    COUNT(*) FILTER (WHERE pb.needs_review = true),
    COUNT(*) FILTER (WHERE tp.moov_account_id IS NULL),
    COUNT(*) FILTER (WHERE tp.moov_account_id IS NOT NULL AND tp.payout_onboarding_completed = false)
  INTO v_total_pending, v_ready_count, v_needs_review, v_no_moov, v_incomplete
  FROM payout_batches pb
  JOIN talent_profiles tp ON tp.id = pb.talent_id
  WHERE pb.status = 'pending';
  
  RAISE NOTICE '';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '🎯 ROOT CAUSE ANALYSIS';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Total Pending Batches: %', v_total_pending;
  RAISE NOTICE '';
  
  IF v_ready_count > 0 THEN
    RAISE NOTICE '❌ PROBLEM: % batches are READY but haven''t processed!', v_ready_count;
    RAISE NOTICE '';
    RAISE NOTICE 'This means:';
    RAISE NOTICE '  - Talent have completed Moov setup ✅';
    RAISE NOTICE '  - Platform settings are correct ✅';
    RAISE NOTICE '  - BUT: The cron job or edge function is failing ❌';
    RAISE NOTICE '';
    RAISE NOTICE 'SOLUTION:';
    RAISE NOTICE '  1. Check if invoke_process_payouts() function works (see above)';
    RAISE NOTICE '  2. Check Railway logs for edge function errors';
    RAISE NOTICE '  3. Verify service role key is correct';
    RAISE NOTICE '  4. Try processing manually in admin panel';
  ELSIF v_needs_review > 0 THEN
    RAISE NOTICE '🔍 PROBLEM: % batches need MANUAL REVIEW (over $1000)', v_needs_review;
    RAISE NOTICE '';
    RAISE NOTICE 'SOLUTION:';
    RAISE NOTICE '  Go to Admin > Payouts and approve these batches manually.';
  ELSIF v_no_moov > 0 THEN
    RAISE NOTICE '❌ PROBLEM: % talent don''t have Moov accounts', v_no_moov;
    RAISE NOTICE '';
    RAISE NOTICE 'SOLUTION:';
    RAISE NOTICE '  Contact these talent to complete payout onboarding.';
  ELSIF v_incomplete > 0 THEN
    RAISE NOTICE '❌ PROBLEM: % talent have incomplete Moov onboarding', v_incomplete;
    RAISE NOTICE '';
    RAISE NOTICE 'SOLUTION:';
    RAISE NOTICE '  Contact these talent to finish their payout setup.';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '';
END $$;

-- Manually process the 7 READY batches that should have been processed automatically
-- This is a one-time fix while we debug why the cron isn't working

-- First, show which batches we're about to process
SELECT 
  '✅ READY TO PROCESS NOW' as section,
  pb.id as batch_id,
  tp.username,
  COALESCE(tp.temp_full_name, tp.username) as talent_name,
  pb.net_payout_amount as amount,
  pb.week_start_date,
  pb.week_end_date,
  pb.created_at
FROM payout_batches pb
JOIN talent_profiles tp ON tp.id = pb.talent_id
WHERE pb.status = 'pending'
  AND tp.moov_account_id IS NOT NULL
  AND tp.bank_account_linked = true
  AND tp.payout_onboarding_completed = true
  AND (pb.needs_review = false OR pb.needs_review IS NULL)
ORDER BY pb.created_at;

-- Now try to process them
DO $$
DECLARE
  v_processed_count INT := 0;
  v_error_message TEXT;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '🚀 PROCESSING READY PAYOUTS';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '';
  
  -- Check if function exists
  IF EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'invoke_process_payouts') THEN
    RAISE NOTICE '✅ invoke_process_payouts() function found';
    RAISE NOTICE 'Calling function now...';
    RAISE NOTICE '';
    
    BEGIN
      -- Call the function
      PERFORM invoke_process_payouts();
      
      -- Count how many changed status
      SELECT COUNT(*) INTO v_processed_count
      FROM payout_batches
      WHERE status IN ('processing', 'paid')
        AND updated_at > NOW() - INTERVAL '5 seconds';
      
      IF v_processed_count > 0 THEN
        RAISE NOTICE '✅ SUCCESS! Processed % batch(es)', v_processed_count;
      ELSE
        RAISE NOTICE '⚠️  Function executed but no batches changed status';
        RAISE NOTICE 'This might mean:';
        RAISE NOTICE '  1. The edge function (moov-process-pending-batches) is failing';
        RAISE NOTICE '  2. The service role key is incorrect';
        RAISE NOTICE '  3. The Moov API returned an error';
        RAISE NOTICE '';
        RAISE NOTICE 'Check Railway logs for edge function errors!';
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_error_message = MESSAGE_TEXT;
      RAISE NOTICE '❌ ERROR: %', v_error_message;
      RAISE NOTICE '';
      RAISE NOTICE 'The function exists but failed to execute!';
    END;
    
  ELSE
    RAISE NOTICE '❌ invoke_process_payouts() function NOT FOUND!';
    RAISE NOTICE '';
    RAISE NOTICE 'SOLUTION: Run database/FIX_PAYOUT_AUTOMATION.sql';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '';
END $$;

-- Show results
SELECT 
  '📊 AFTER PROCESSING' as section,
  COUNT(*) FILTER (WHERE status = 'pending') as still_pending,
  COUNT(*) FILTER (WHERE status = 'processing') as processing,
  COUNT(*) FILTER (WHERE status = 'paid') as paid,
  COALESCE(SUM(net_payout_amount) FILTER (WHERE status = 'pending'), 0) as pending_amount
FROM payout_batches
WHERE created_at > NOW() - INTERVAL '7 days';

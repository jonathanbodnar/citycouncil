-- Check if invoke_process_payouts function exists and recreate it if needed

-- First, check if it exists
DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'invoke_process_payouts') THEN
    RAISE NOTICE '✅ Function EXISTS - dropping and recreating it...';
    DROP FUNCTION IF EXISTS invoke_process_payouts();
  ELSE
    RAISE NOTICE '❌ Function DOES NOT EXIST - creating it now...';
  END IF;
END $$;

-- Recreate the function with the correct service role key
CREATE OR REPLACE FUNCTION invoke_process_payouts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_service_role_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0YWZldGFtZ3d1a2ticmxlemV2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyMzk0OTUzNiwiZXhwIjoyMDM5NTI1NTM2fQ.iXwEoQ8OBvQ1kEGO6Y1zqQGUovJxjH4xfRCcGD6FYVY';
  v_function_url TEXT := 'https://utafetamgwukkbrlezev.supabase.co/functions/v1/moov-process-pending-batches';
  v_response TEXT;
  v_talent_id UUID;
BEGIN
  -- Process each distinct talent_id with pending batches
  FOR v_talent_id IN
    SELECT DISTINCT pb.talent_id
    FROM payout_batches pb
    JOIN talent_profiles tp ON tp.id = pb.talent_id
    WHERE pb.status = 'pending'
      AND pb.net_payout_amount > 0
      AND tp.moov_account_id IS NOT NULL
      AND tp.bank_account_linked = true
      AND tp.payout_onboarding_completed = true
  LOOP
    -- Call the edge function for each talent
    BEGIN
      SELECT content INTO v_response
      FROM http((
        'POST',
        v_function_url,
        ARRAY[
          http_header('Authorization', 'Bearer ' || v_service_role_key),
          http_header('Content-Type', 'application/json')
        ],
        'application/json',
        json_build_object('talentId', v_talent_id)::text
      )::http_request);
      
      RAISE NOTICE 'Processed talent: % - Response: %', v_talent_id, v_response;
      
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error processing talent %: %', v_talent_id, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE 'Payout processing completed';
END;
$$;

-- Test the function
DO $$
DECLARE
  v_before_count INT;
  v_after_count INT;
BEGIN
  -- Count pending batches before
  SELECT COUNT(*) INTO v_before_count
  FROM payout_batches pb
  JOIN talent_profiles tp ON tp.id = pb.talent_id
  WHERE pb.status = 'pending'
    AND tp.moov_account_id IS NOT NULL
    AND tp.bank_account_linked = true
    AND tp.payout_onboarding_completed = true;
  
  RAISE NOTICE '';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '🧪 TESTING invoke_process_payouts()';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Ready batches BEFORE: %', v_before_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Calling function...';
  RAISE NOTICE '';
  
  -- Call the function
  PERFORM invoke_process_payouts();
  
  -- Wait a moment for processing
  PERFORM pg_sleep(2);
  
  -- Count pending batches after
  SELECT COUNT(*) INTO v_after_count
  FROM payout_batches pb
  JOIN talent_profiles tp ON tp.id = pb.talent_id
  WHERE pb.status = 'pending'
    AND tp.moov_account_id IS NOT NULL
    AND tp.bank_account_linked = true
    AND tp.payout_onboarding_completed = true;
  
  RAISE NOTICE '';
  RAISE NOTICE 'Ready batches AFTER: %', v_after_count;
  RAISE NOTICE '';
  
  IF v_after_count < v_before_count THEN
    RAISE NOTICE '✅ SUCCESS! Processed % batch(es)', v_before_count - v_after_count;
  ELSIF v_before_count = 0 THEN
    RAISE NOTICE '⚠️  No ready batches to process';
  ELSE
    RAISE NOTICE '❌ FAILED! Batches are still pending';
    RAISE NOTICE '';
    RAISE NOTICE 'This means the edge function is failing.';
    RAISE NOTICE 'Check Railway logs at:';
    RAISE NOTICE 'https://railway.app/project/.../deployments';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '';
END $$;

-- Show current status
SELECT 
  '📊 CURRENT STATUS' as section,
  COUNT(*) FILTER (WHERE pb.status = 'pending' AND tp.moov_account_id IS NOT NULL AND tp.bank_account_linked AND tp.payout_onboarding_completed) as ready_pending,
  COUNT(*) FILTER (WHERE pb.status = 'processing') as processing,
  COUNT(*) FILTER (WHERE pb.status = 'paid') as paid_today
FROM payout_batches pb
JOIN talent_profiles tp ON tp.id = pb.talent_id
WHERE pb.created_at > NOW() - INTERVAL '7 days';

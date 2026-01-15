-- Setup automatic payout processing via cron job
-- This will check for pending payouts every hour and process them

-- 1. Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Create a function to invoke the payout processing edge function
CREATE OR REPLACE FUNCTION invoke_process_payouts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_talent_id UUID;
  v_service_role_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0YWZldGFtZ3d1a2ticmxlemV2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyOTU0NzU4MywiZXhwIjoyMDQ1MTIzNTgzfQ.1Z_s8p6Rt7MkjOhDMFpLKy3VVbGaWx-WjCxJQJJ-4bw';
  v_url TEXT;
  v_response_id BIGINT;
BEGIN
  -- Get all talents with pending batches who are ready for payouts
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
    -- Invoke the edge function for each talent
    v_url := 'https://utafetamgwukkbrlezev.supabase.co/functions/v1/moov-process-pending-batches';
    
    SELECT net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_role_key
      ),
      body := jsonb_build_object(
        'talentId', v_talent_id
      )
    ) INTO v_response_id;
    
    -- Log the request (optional)
    RAISE NOTICE 'Triggered payout processing for talent: %', v_talent_id;
  END LOOP;
  
  RAISE NOTICE 'Payout processing complete';
END;
$$;

-- 3. Unschedule any existing payout cron jobs
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname IN ('process-pending-payouts', 'auto-process-payouts');

-- 4. Schedule the cron job to run every hour
-- This will check for pending payouts and process them automatically
SELECT cron.schedule(
  'auto-process-payouts',
  '0 * * * *',  -- Every hour at minute 0
  $$SELECT invoke_process_payouts()$$
);

-- 5. Verify the cron job was created
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  command
FROM cron.job
WHERE jobname = 'auto-process-payouts';

-- 6. Also create a manual trigger function for admin use
CREATE OR REPLACE FUNCTION manually_process_all_pending_payouts()
RETURNS TABLE(
  talent_id UUID,
  talent_username TEXT,
  batches_processed INT,
  total_amount DECIMAL,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tp.id as talent_id,
    tp.username as talent_username,
    COUNT(pb.id)::INT as batches_processed,
    COALESCE(SUM(pb.net_payout_amount), 0) as total_amount,
    CASE 
      WHEN tp.moov_account_id IS NULL THEN '❌ No Moov Account'
      WHEN NOT tp.bank_account_linked THEN '❌ Bank Not Linked'
      WHEN NOT tp.payout_onboarding_completed THEN '❌ Onboarding Incomplete'
      ELSE '✅ Ready to Process'
    END as status
  FROM talent_profiles tp
  LEFT JOIN payout_batches pb ON pb.talent_id = tp.id AND pb.status = 'pending'
  WHERE EXISTS (
    SELECT 1 FROM payout_batches 
    WHERE talent_id = tp.id AND status = 'pending'
  )
  GROUP BY tp.id, tp.username, tp.moov_account_id, tp.bank_account_linked, tp.payout_onboarding_completed
  ORDER BY batches_processed DESC;
END;
$$;

-- 7. Display setup confirmation
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '✅ AUTOMATIC PAYOUT PROCESSING SETUP COMPLETE';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Cron Job: auto-process-payouts';
  RAISE NOTICE 'Schedule: Every hour (at minute 0)';
  RAISE NOTICE 'Function: invoke_process_payouts()';
  RAISE NOTICE '';
  RAISE NOTICE 'The system will now automatically:';
  RAISE NOTICE '  1. Check for pending payout batches every hour';
  RAISE NOTICE '  2. Verify talent has completed Moov setup';
  RAISE NOTICE '  3. Process payouts via Moov API';
  RAISE NOTICE '  4. Update batch status to processing/paid';
  RAISE NOTICE '';
  RAISE NOTICE 'Manual Processing:';
  RAISE NOTICE '  - Call invoke_process_payouts() to trigger immediately';
  RAISE NOTICE '  - Call manually_process_all_pending_payouts() to see status';
  RAISE NOTICE '';
  RAISE NOTICE 'Next automatic run: Top of next hour';
  RAISE NOTICE '';
END $$;

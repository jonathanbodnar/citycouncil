-- ⚠️ CRITICAL FIX: Enable automatic payout processing
-- This script fixes the issue where payouts stay "pending" forever

-- =================================================================
-- ISSUE: Payouts are created but never automatically processed
-- SOLUTION: Enable payouts + setup cron job for automatic processing
-- =================================================================

-- 1. Enable payouts in platform settings
INSERT INTO platform_settings (setting_key, setting_value, description)
VALUES ('payouts_enabled', 'true', 'Enable/disable automatic payout processing')
ON CONFLICT (setting_key) 
DO UPDATE SET 
  setting_value = 'true',
  updated_at = NOW();

-- 2. Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 3. Create function to invoke payout processing edge function
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
  v_processed_count INT := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🔄 Starting automatic payout processing...';
  RAISE NOTICE '';
  
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
    
    BEGIN
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
      
      v_processed_count := v_processed_count + 1;
      RAISE NOTICE '  ✅ Triggered processing for talent: %', v_talent_id;
      
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '  ❌ Error processing talent %: %', v_talent_id, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ Payout processing complete. Processed % talent(s).', v_processed_count;
  RAISE NOTICE '';
END;
$$;

-- 4. Unschedule any existing payout cron jobs (clean slate)
DO $$
DECLARE
  v_job RECORD;
BEGIN
  FOR v_job IN 
    SELECT jobid FROM cron.job 
    WHERE jobname IN ('process-pending-payouts', 'auto-process-payouts')
  LOOP
    PERFORM cron.unschedule(v_job.jobid);
  END LOOP;
END $$;

-- 5. Schedule automatic payout processing every hour
SELECT cron.schedule(
  'auto-process-payouts',           -- Job name
  '0 * * * *',                      -- Every hour at minute 0 (top of the hour)
  $$SELECT invoke_process_payouts()$$  -- Command to run
);

-- 6. Test the system immediately (process any pending payouts now)
SELECT invoke_process_payouts();

-- 7. Show current status
SELECT 
  '🎯 CRON JOB STATUS' as section,
  jobid,
  jobname,
  schedule,
  active,
  CASE 
    WHEN active THEN '✅ ACTIVE'
    ELSE '❌ INACTIVE'
  END as status
FROM cron.job
WHERE jobname = 'auto-process-payouts';

-- 8. Show pending batches that should be processed
SELECT 
  '📊 PENDING BATCHES' as section,
  tp.username,
  tp.display_name,
  pb.week_start_date,
  COUNT(p.id) as num_orders,
  pb.net_payout_amount,
  pb.status,
  CASE 
    WHEN tp.moov_account_id IS NOT NULL 
      AND tp.bank_account_linked 
      AND tp.payout_onboarding_completed THEN '✅ Ready'
    ELSE '❌ Setup Incomplete'
  END as ready_status
FROM payout_batches pb
JOIN talent_profiles tp ON tp.id = pb.talent_id
LEFT JOIN payouts p ON p.batch_id = pb.id
WHERE pb.status = 'pending'
GROUP BY tp.username, tp.display_name, pb.id, pb.week_start_date, pb.net_payout_amount, 
         pb.status, tp.moov_account_id, tp.bank_account_linked, tp.payout_onboarding_completed
ORDER BY pb.created_at;

-- 9. Show recent cron job runs (if any)
SELECT 
  '⏰ RECENT CRON RUNS' as section,
  status,
  LEFT(return_message, 100) as message,
  start_time,
  end_time
FROM cron.job_run_details
WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname = 'auto-process-payouts')
ORDER BY start_time DESC
LIMIT 5;

-- 10. Final status report
DO $$
DECLARE
  v_pending_batches INT;
  v_total_pending DECIMAL;
  v_payouts_enabled BOOLEAN;
  v_cron_active BOOLEAN;
  v_ready_talent INT;
  v_not_ready_talent INT;
BEGIN
  -- Get counts
  SELECT COUNT(*), COALESCE(SUM(net_payout_amount), 0)
  INTO v_pending_batches, v_total_pending
  FROM payout_batches
  WHERE status = 'pending';
  
  SELECT setting_value::BOOLEAN INTO v_payouts_enabled
  FROM platform_settings
  WHERE setting_key = 'payouts_enabled';
  
  SELECT active INTO v_cron_active
  FROM cron.job
  WHERE jobname = 'auto-process-payouts';
  
  SELECT 
    COUNT(*) FILTER (WHERE moov_account_id IS NOT NULL AND bank_account_linked AND payout_onboarding_completed),
    COUNT(*) FILTER (WHERE moov_account_id IS NOT NULL AND (NOT bank_account_linked OR NOT payout_onboarding_completed))
  INTO v_ready_talent, v_not_ready_talent
  FROM talent_profiles
  WHERE EXISTS (SELECT 1 FROM payout_batches WHERE talent_id = talent_profiles.id AND status = 'pending');
  
  RAISE NOTICE '';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '💰 PAYOUT AUTOMATION - FINAL STATUS';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'System Configuration:';
  RAISE NOTICE '  • Payouts Enabled: %', CASE WHEN v_payouts_enabled THEN '✅ YES' ELSE '❌ NO' END;
  RAISE NOTICE '  • Cron Job Active: %', CASE WHEN v_cron_active THEN '✅ YES' ELSE '❌ NO' END;
  RAISE NOTICE '  • Schedule: Every hour (top of hour)';
  RAISE NOTICE '';
  RAISE NOTICE 'Current Pending Payouts:';
  RAISE NOTICE '  • Pending Batches: %', v_pending_batches;
  RAISE NOTICE '  • Total Amount: $%', v_total_pending;
  RAISE NOTICE '  • Talent Ready: %', v_ready_talent;
  RAISE NOTICE '  • Talent Not Ready: %', v_not_ready_talent;
  RAISE NOTICE '';
  
  IF v_payouts_enabled AND v_cron_active THEN
    RAISE NOTICE '✅ SUCCESS: Automatic payout processing is now enabled!';
    RAISE NOTICE '';
    RAISE NOTICE 'What happens next:';
    RAISE NOTICE '  1. Cron job runs every hour automatically';
    RAISE NOTICE '  2. Checks for pending batches with ready talent';
    RAISE NOTICE '  3. Sends payout requests to Moov';
    RAISE NOTICE '  4. Updates batch status to processing/paid';
    RAISE NOTICE '';
    
    IF v_pending_batches > 0 AND v_ready_talent > 0 THEN
      RAISE NOTICE '🔄 Pending payouts will be processed within the next hour';
    ELSIF v_pending_batches > 0 AND v_ready_talent = 0 THEN
      RAISE NOTICE '⚠️  Pending batches exist but talent needs to complete setup';
    ELSE
      RAISE NOTICE 'ℹ️  No pending payouts to process right now';
    END IF;
  ELSE
    RAISE NOTICE '❌ ERROR: Automatic processing is not fully enabled!';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '';
END $$;

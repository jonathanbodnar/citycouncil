-- Create daily cron job for Instagram tracking
-- Run this in Supabase SQL Editor after deploying the instagram-tracker edge function

-- Schedule the Instagram tracker to run daily at 2 AM UTC
SELECT cron.schedule(
  'instagram-daily-tracking',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://utafetamgwukkbrlezev.supabase.co/functions/v1/instagram-tracker',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0YWZldGFtZ3d1a2ticmxlemV2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTg2ODMwMCwiZXhwIjoyMDc1NDQ0MzAwfQ.bmjLfmsX3_wYxjyHZzFoVhZ4XxJvqbH8DIfpHTXVrKQ',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);

-- To check if the job was created successfully:
-- SELECT * FROM cron.job WHERE jobname = 'instagram-daily-tracking';

-- To see recent job runs:
-- SELECT * FROM cron.job_run_details 
-- WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'instagram-daily-tracking')
-- ORDER BY start_time DESC
-- LIMIT 10;

-- To unschedule the job if needed:
-- SELECT cron.unschedule('instagram-daily-tracking');

-- Create daily cron job for Instagram tracking
-- Run this in Supabase SQL Editor after deploying the instagram-tracker edge function

-- First, check if the cron extension is enabled (it should be by default in Supabase)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the Instagram tracker to run daily at 2 AM UTC
SELECT cron.schedule(
  'instagram-daily-tracking',                  -- Job name
  '0 2 * * *',                                 -- Cron schedule: Every day at 2 AM UTC
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_ID.supabase.co/functions/v1/instagram-tracker',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);

-- To check if the job was created successfully:
SELECT * FROM cron.job WHERE jobname = 'instagram-daily-tracking';

-- To see recent job runs:
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'instagram-daily-tracking')
ORDER BY start_time DESC
LIMIT 10;

-- To manually trigger the job (for testing):
-- Just call the edge function directly:
-- curl -X POST https://YOUR_PROJECT_ID.supabase.co/functions/v1/instagram-tracker \
--   -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"

-- To unschedule the job (if you need to remove it):
-- SELECT cron.unschedule('instagram-daily-tracking');

-- To reschedule with different timing (example: every 6 hours):
-- SELECT cron.schedule(
--   'instagram-daily-tracking',
--   '0 */6 * * *',  -- Every 6 hours
--   $$ [same http_post command as above] $$
-- );

/*
NOTES:
1. Replace YOUR_PROJECT_ID with your actual Supabase project ID
   Find it in: Supabase Dashboard → Settings → General → Reference ID
   
2. Replace YOUR_SERVICE_ROLE_KEY with your service role key
   Find it in: Supabase Dashboard → Settings → API → service_role secret key
   WARNING: NEVER commit this key to git!
   
3. Cron schedule syntax: minute hour day month weekday
   Examples:
   0 2 * * * = Every day at 2:00 AM UTC
   0 */6 * * * = Every 6 hours  
   0 8 * * 1 = Every Monday at 8:00 AM
   */30 * * * * = Every 30 minutes
   
4. Time zones:
   Cron runs in UTC by default
   2 AM UTC = 10 PM EST previous day / 7 PM PST previous day
   Adjust schedule as needed for your timezone
   
5. The edge function will:
   Fetch all talent with Instagram connected
   Check their bio for shoutout.us links
   Scan recent posts for @shoutoutvoice tags
   Update the tracking tables
   
6. Monitoring:
   Check cron.job_run_details to see execution history
   Check Edge Function logs in Supabase Dashboard
   Set up alerts for failed runs if needed
*/


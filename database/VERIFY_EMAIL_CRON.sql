-- Verify email flow cron job is set up and running

-- 1. Check if cron extension is enabled
SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- 2. Check if email flow cron job exists
SELECT 
  jobid,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active,
  jobname
FROM cron.job
WHERE jobname = 'process-email-flows';

-- 3. Check recent cron job runs
SELECT 
  jobid,
  runid,
  job_pid,
  database,
  username,
  command,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname = 'process-email-flows')
ORDER BY start_time DESC
LIMIT 10;

-- 4. If cron job doesn't exist, here's how to create it:
-- Run setup_email_flows_cron.sql from the database folder


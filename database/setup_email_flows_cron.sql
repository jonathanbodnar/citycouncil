-- Set up cron job to process email flows every 5 minutes
-- Run this in Supabase SQL Editor

-- First, ensure pg_cron and pg_net extensions are enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove existing cron job if it exists (unschedule returns void, so we wrap in DO block)
DO $$
BEGIN
  PERFORM cron.unschedule('process-email-flows');
EXCEPTION
  WHEN undefined_object THEN
    NULL; -- Job doesn't exist, that's fine
END $$;

-- Create new cron job to run every 5 minutes
SELECT cron.schedule(
  'process-email-flows',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT
    net.http_post(
      url := 'https://qlhkxuxyegtfnajbhxgr.supabase.co/functions/v1/process-email-flows',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      )
    );
  $$
);

-- Verify the cron job was created
SELECT * FROM cron.job WHERE jobname = 'process-email-flows';


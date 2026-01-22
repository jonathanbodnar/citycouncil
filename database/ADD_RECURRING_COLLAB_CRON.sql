-- Set up pg_cron job to process recurring collab payments
-- This runs daily at 6 AM UTC to process any subscriptions due for billing

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a function that calls the process-recurring-payments edge function
CREATE OR REPLACE FUNCTION process_recurring_collab_payments()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Call the Edge Function to process recurring payments
  SELECT content::jsonb INTO result
  FROM http((
    'POST',
    CONCAT(current_setting('app.settings.supabase_url'), '/functions/v1/process-recurring-payments'),
    ARRAY[
      http_header('Authorization', CONCAT('Bearer ', current_setting('app.settings.service_role_key'))),
      http_header('Content-Type', 'application/json')
    ],
    'application/json',
    '{}'
  )::http_request);
  
  -- Log the result
  RAISE NOTICE 'Recurring payments processed: %', result;
END;
$$;

-- Schedule the cron job to run daily at 6 AM UTC
-- This checks for any subscriptions with next_billing_date <= NOW() and processes them
SELECT cron.schedule(
  'process-recurring-collab-payments',  -- Job name
  '0 6 * * *',                          -- Cron expression: At 06:00 every day
  $$SELECT process_recurring_collab_payments()$$
);

-- Alternative: If http extension is not available, you can use pg_net instead
-- This is more commonly available on Supabase
/*
-- Using pg_net (Supabase's async HTTP extension)
SELECT cron.schedule(
  'process-recurring-collab-payments',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := CONCAT(current_setting('app.settings.supabase_url'), '/functions/v1/process-recurring-payments'),
    headers := jsonb_build_object(
      'Authorization', CONCAT('Bearer ', current_setting('app.settings.service_role_key')),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  )
  $$
);
*/

-- You can also run it manually to test:
-- SELECT process_recurring_collab_payments();

-- To check scheduled jobs:
-- SELECT * FROM cron.job;

-- To check job run history:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;

-- To unschedule the job if needed:
-- SELECT cron.unschedule('process-recurring-collab-payments');

COMMENT ON FUNCTION process_recurring_collab_payments() IS 
'Processes recurring collab subscription payments. Called daily by pg_cron.
Finds subscriptions with next_billing_date <= NOW() and charges them using their saved Fortis token.';

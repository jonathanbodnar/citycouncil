-- Check if there are any Edge Function invocation logs for Shawn's orders
-- This would show if upload reached the watermark step

-- Note: Edge function logs are typically stored in Supabase's logging system
-- You'll need to check the Supabase Dashboard > Edge Functions > watermark-video > Logs

-- For now, let's check if any notifications were sent (which would indicate upload success)
SELECT 
  n.id,
  n.order_id,
  n.user_id,
  n.type,
  n.title,
  n.message,
  n.is_read,
  n.created_at,
  o.status as order_status,
  o.video_url
FROM notifications n
JOIN orders o ON o.id = n.order_id
WHERE n.order_id IN (
  '8e01dd16-90df-44c7-a440-1919ce26acf4',
  '30ffb97f-f1e3-417a-9a7d-285ea69b019c'
)
ORDER BY n.created_at DESC;

-- Check SMS logs if any were sent
SELECT 
  id,
  order_id,
  phone_number,
  message_type,
  status,
  error_message,
  created_at
FROM sms_logs
WHERE order_id IN (
  '8e01dd16-90df-44c7-a440-1919ce26acf4',
  '30ffb97f-f1e3-417a-9a7d-285ea69b019c'
)
ORDER BY created_at DESC;


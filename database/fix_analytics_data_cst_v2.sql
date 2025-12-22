-- Fix get_analytics_data_cst function - Version 2
-- The issue: AT TIME ZONE with timestamp (not timestamptz) converts TO that timezone
-- We need to interpret the date as CST and convert to UTC for comparison

DROP FUNCTION IF EXISTS get_analytics_data_cst(text, text);

CREATE OR REPLACE FUNCTION get_analytics_data_cst(start_date text, end_date text)
RETURNS TABLE (
  record_type text,
  cst_date text,
  promo_source text,
  did_holiday_popup boolean
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  start_ts timestamptz;
  end_ts timestamptz;
BEGIN
  -- Convert CST date strings to UTC timestamps for comparison
  -- "2025-12-11 00:00:00 CST" needs to become the UTC equivalent
  -- Using timezone() function which is clearer
  start_ts := timezone('America/Chicago', (start_date || ' 00:00:00')::timestamp);
  end_ts := timezone('America/Chicago', (end_date || ' 23:59:59.999')::timestamp);

  RETURN QUERY
  -- Orders
  SELECT 
    'order'::text as record_type,
    to_char(timezone('America/Chicago', o.created_at), 'YYYY-MM-DD') as cst_date,
    o.promo_source::text,
    o.did_holiday_popup
  FROM orders o
  WHERE o.created_at >= start_ts 
    AND o.created_at <= end_ts
    AND o.is_demo_order IS NOT TRUE
  
  UNION ALL
  
  -- Users (non-talent)
  SELECT 
    'user'::text as record_type,
    to_char(timezone('America/Chicago', u.created_at), 'YYYY-MM-DD') as cst_date,
    u.promo_source::text,
    u.did_holiday_popup
  FROM users u
  WHERE u.created_at >= start_ts 
    AND u.created_at <= end_ts
    AND u.user_type = 'user'
  
  UNION ALL
  
  -- SMS signups (beta_signups)
  SELECT 
    'sms'::text as record_type,
    to_char(timezone('America/Chicago', b.subscribed_at), 'YYYY-MM-DD') as cst_date,
    b.utm_source::text as promo_source,
    false as did_holiday_popup
  FROM beta_signups b
  WHERE b.subscribed_at >= start_ts 
    AND b.subscribed_at <= end_ts;
END;
$$;

GRANT EXECUTE ON FUNCTION get_analytics_data_cst(text, text) TO authenticated;

-- Test with a wide date range to verify it works
SELECT record_type, cst_date, COUNT(*) 
FROM get_analytics_data_cst('2025-11-01', '2025-12-31')
GROUP BY record_type, cst_date
ORDER BY cst_date DESC, record_type
LIMIT 30;



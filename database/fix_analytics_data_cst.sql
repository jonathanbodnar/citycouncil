-- Fix get_analytics_data_cst function to correctly handle date ranges
-- The function should accept date strings (YYYY-MM-DD) and return records
-- with their created_at/subscribed_at converted to CST date strings

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
  -- Convert date strings to CST midnight timestamps
  -- start_date at 00:00:00 CST
  start_ts := (start_date || ' 00:00:00')::timestamp AT TIME ZONE 'America/Chicago';
  -- end_date at 23:59:59.999 CST  
  end_ts := (end_date || ' 23:59:59.999')::timestamp AT TIME ZONE 'America/Chicago';
  
  RAISE NOTICE 'Analytics query: start_date=%, end_date=%, start_ts=%, end_ts=%', start_date, end_date, start_ts, end_ts;

  RETURN QUERY
  -- Orders
  SELECT 
    'order'::text as record_type,
    to_char(o.created_at AT TIME ZONE 'America/Chicago', 'YYYY-MM-DD') as cst_date,
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
    to_char(u.created_at AT TIME ZONE 'America/Chicago', 'YYYY-MM-DD') as cst_date,
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
    to_char(b.subscribed_at AT TIME ZONE 'America/Chicago', 'YYYY-MM-DD') as cst_date,
    b.utm_source::text as promo_source,
    false as did_holiday_popup
  FROM beta_signups b
  WHERE b.subscribed_at >= start_ts 
    AND b.subscribed_at <= end_ts;
END;
$$;

-- Grant execute to authenticated users (for admin access)
GRANT EXECUTE ON FUNCTION get_analytics_data_cst(text, text) TO authenticated;

-- Test the function
SELECT * FROM get_analytics_data_cst('2025-12-11', '2025-12-14') LIMIT 20;



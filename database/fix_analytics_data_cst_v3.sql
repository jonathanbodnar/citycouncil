-- Fix get_analytics_data_cst function - Version 3
-- Simplified approach: just filter by the CST date string directly

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
BEGIN
  RETURN QUERY
  -- Orders: convert created_at to CST date string, then filter
  SELECT 
    'order'::text as record_type,
    to_char(o.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago', 'YYYY-MM-DD') as cst_date,
    o.promo_source::text,
    o.did_holiday_popup
  FROM orders o
  WHERE to_char(o.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago', 'YYYY-MM-DD') >= start_date
    AND to_char(o.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago', 'YYYY-MM-DD') <= end_date
    AND o.is_demo_order IS NOT TRUE
  
  UNION ALL
  
  -- Users (non-talent)
  SELECT 
    'user'::text as record_type,
    to_char(u.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago', 'YYYY-MM-DD') as cst_date,
    u.promo_source::text,
    u.did_holiday_popup
  FROM users u
  WHERE to_char(u.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago', 'YYYY-MM-DD') >= start_date
    AND to_char(u.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago', 'YYYY-MM-DD') <= end_date
    AND u.user_type = 'user'
  
  UNION ALL
  
  -- SMS signups (beta_signups)
  SELECT 
    'sms'::text as record_type,
    to_char(b.subscribed_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago', 'YYYY-MM-DD') as cst_date,
    b.utm_source::text as promo_source,
    false as did_holiday_popup
  FROM beta_signups b
  WHERE to_char(b.subscribed_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago', 'YYYY-MM-DD') >= start_date
    AND to_char(b.subscribed_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago', 'YYYY-MM-DD') <= end_date;
END;
$$;

GRANT EXECUTE ON FUNCTION get_analytics_data_cst(text, text) TO authenticated;

-- Test it
SELECT record_type, cst_date, COUNT(*) 
FROM get_analytics_data_cst('2025-11-01', '2025-12-31')
GROUP BY record_type, cst_date
ORDER BY cst_date DESC, record_type
LIMIT 50;



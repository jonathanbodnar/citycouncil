-- Create views and functions to exclude demo orders from statistics
-- This ensures demo orders don't inflate earnings, order counts, etc.

-- 1. Create a view for real (non-demo) orders only
CREATE OR REPLACE VIEW real_orders AS
SELECT *
FROM orders
WHERE order_type IS DISTINCT FROM 'demo'  -- Excludes 'demo' and NULL (backward compatible)
   OR order_type IS NULL;  -- Include NULL for backward compatibility with old orders

-- 2. Create a view for talent stats (excluding demo orders)
CREATE OR REPLACE VIEW talent_stats AS
SELECT 
  tp.id as talent_id,
  tp.username,
  u.full_name as talent_name,
  COUNT(o.id) FILTER (WHERE o.status = 'completed') as completed_orders,
  COUNT(o.id) FILTER (WHERE o.status = 'pending') as pending_orders,
  COUNT(o.id) FILTER (WHERE o.status = 'in_progress') as in_progress_orders,
  COUNT(o.id) as total_orders,
  COALESCE(SUM(o.amount) FILTER (WHERE o.status = 'completed'), 0) as total_earnings_cents,
  COALESCE(AVG(r.rating), 0) as avg_rating,
  COUNT(r.id) as review_count
FROM talent_profiles tp
LEFT JOIN users u ON tp.user_id = u.id
LEFT JOIN orders o ON o.talent_id = tp.id 
  AND (o.order_type IS DISTINCT FROM 'demo' OR o.order_type IS NULL)  -- Exclude demo orders
LEFT JOIN reviews r ON r.talent_id = tp.id
GROUP BY tp.id, tp.username, u.full_name;

-- 3. Create a function to get talent earnings (excluding demo orders)
CREATE OR REPLACE FUNCTION get_talent_earnings(p_talent_id UUID)
RETURNS TABLE (
  total_earnings NUMERIC,
  completed_orders INTEGER,
  pending_amount NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(o.amount) FILTER (WHERE o.status = 'completed'), 0)::NUMERIC / 100 as total_earnings,
    COUNT(o.id) FILTER (WHERE o.status = 'completed')::INTEGER as completed_orders,
    COALESCE(SUM(o.amount) FILTER (WHERE o.status = 'pending' OR o.status = 'in_progress'), 0)::NUMERIC / 100 as pending_amount
  FROM orders o
  WHERE o.talent_id = p_talent_id
    AND (o.order_type IS DISTINCT FROM 'demo' OR o.order_type IS NULL);  -- Exclude demo orders
END;
$$ LANGUAGE plpgsql;

-- 4. Create a function to get platform stats (excluding demo orders)
CREATE OR REPLACE FUNCTION get_platform_stats()
RETURNS TABLE (
  total_talents INTEGER,
  active_talents INTEGER,
  total_orders INTEGER,
  completed_orders INTEGER,
  total_revenue_cents BIGINT,
  avg_order_value_cents NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT tp.id)::INTEGER as total_talents,
    COUNT(DISTINCT tp.id) FILTER (WHERE tp.is_active = true)::INTEGER as active_talents,
    COUNT(o.id)::INTEGER as total_orders,
    COUNT(o.id) FILTER (WHERE o.status = 'completed')::INTEGER as completed_orders,
    COALESCE(SUM(o.amount), 0)::BIGINT as total_revenue_cents,
    COALESCE(AVG(o.amount), 0)::NUMERIC as avg_order_value_cents
  FROM talent_profiles tp
  LEFT JOIN orders o ON o.talent_id = tp.id 
    AND (o.order_type IS DISTINCT FROM 'demo' OR o.order_type IS NULL);  -- Exclude demo orders
END;
$$ LANGUAGE plpgsql;

-- 5. Update existing stats queries to use the new views

-- Example: Get top earning talents (excluding demo orders)
CREATE OR REPLACE VIEW top_earning_talents AS
SELECT 
  ts.talent_id,
  ts.username,
  ts.talent_name,
  ts.completed_orders,
  ts.total_earnings_cents / 100.0 as total_earnings,
  ts.avg_rating,
  ts.review_count
FROM talent_stats ts
WHERE ts.completed_orders > 0
ORDER BY ts.total_earnings_cents DESC
LIMIT 10;

-- 6. Add index to optimize queries filtering by order_type
CREATE INDEX IF NOT EXISTS idx_orders_order_type ON orders(order_type) WHERE order_type IS NOT NULL;

-- Verify views and functions
SELECT 
  'real_orders view' as check_type,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'real_orders') 
    THEN '✅ View created'
    ELSE '❌ View missing'
  END as status;

SELECT 
  'talent_stats view' as check_type,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'talent_stats') 
    THEN '✅ View created'
    ELSE '❌ View missing'
  END as status;

SELECT 
  'get_talent_earnings function' as check_type,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_talent_earnings') 
    THEN '✅ Function created'
    ELSE '❌ Function missing'
  END as status;

-- Test: Show stats with and without demo orders
SELECT 'Orders including demos:' as label, COUNT(*) as count FROM orders;
SELECT 'Orders excluding demos:' as label, COUNT(*) as count FROM real_orders;
SELECT 'Demo orders only:' as label, COUNT(*) as count FROM orders WHERE order_type = 'demo';

-- Show talent stats (excluding demo orders)
SELECT * FROM talent_stats
ORDER BY total_earnings_cents DESC
LIMIT 5;


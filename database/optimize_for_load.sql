-- Optimize database for high concurrent load
-- Address stress test errors: timeouts, internal errors, connection issues

-- 1. Add missing indexes to speed up common queries
-- These will dramatically reduce query time under load

-- Orders table indexes
CREATE INDEX IF NOT EXISTS idx_orders_talent_id_status 
ON orders(talent_id, status) WHERE status IN ('pending', 'in_progress');

CREATE INDEX IF NOT EXISTS idx_orders_user_id_status 
ON orders(user_id, status);

CREATE INDEX IF NOT EXISTS idx_orders_status_created 
ON orders(status, created_at DESC);

-- Talent profiles indexes
CREATE INDEX IF NOT EXISTS idx_talent_profiles_username_lower 
ON talent_profiles(LOWER(username));

CREATE INDEX IF NOT EXISTS idx_talent_profiles_is_active_featured 
ON talent_profiles(is_active, is_featured) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_talent_profiles_category 
ON talent_profiles(category) WHERE is_active = true;

-- Notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_read 
ON notifications(user_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_order_id 
ON notifications(order_id) WHERE order_id IS NOT NULL;

-- Reviews indexes
CREATE INDEX IF NOT EXISTS idx_reviews_talent_id_created 
ON reviews(talent_id, created_at DESC);

-- Payouts indexes (already exist but verify)
CREATE INDEX IF NOT EXISTS idx_payouts_talent_status 
ON payouts(talent_id, status);

CREATE INDEX IF NOT EXISTS idx_payouts_week_dates 
ON payouts(week_start_date, week_end_date);

-- 2. Add composite indexes for common join patterns
CREATE INDEX IF NOT EXISTS idx_orders_talent_video 
ON orders(talent_id, video_url) WHERE video_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_user_created 
ON orders(user_id, created_at DESC);

-- 3. Optimize RLS policies with indexes
-- This helps RLS queries run faster
CREATE INDEX IF NOT EXISTS idx_talent_profiles_user_id 
ON talent_profiles(user_id);

-- 4. Add partial indexes for hot paths
CREATE INDEX IF NOT EXISTS idx_orders_pending_only 
ON orders(created_at DESC) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_orders_completed_only 
ON orders(updated_at DESC) WHERE status = 'completed';

-- 5. Analyze tables to update statistics
ANALYZE orders;
ANALYZE talent_profiles;
ANALYZE notifications;
ANALYZE reviews;
ANALYZE payouts;
ANALYZE payout_batches;
ANALYZE users;

-- 6. Show all indexes created
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('orders', 'talent_profiles', 'notifications', 'reviews', 'payouts')
ORDER BY tablename, indexname;

-- 7. Check query performance
-- Run this to see slow queries in production
SELECT 
    'To monitor slow queries, enable pg_stat_statements extension' as note,
    'Then run: SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;' as command;


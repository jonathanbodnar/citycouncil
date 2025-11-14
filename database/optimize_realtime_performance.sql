-- Optimize Realtime Performance
-- Address the 85% database time issue from realtime.list_changes()

-- Issue: Realtime subscriptions are causing 85% of database load
-- The query "SELECT wal->>$5 as type..." from realtime.list_changes() is eating resources

-- Solution 1: Reduce realtime polling frequency
-- This is controlled by Supabase Realtime settings
-- Recommendation: Only subscribe to critical tables

-- Solution 2: Add indexes to tables with realtime subscriptions
-- These help Realtime filter changes more efficiently

-- Check which tables have realtime enabled
SELECT 
    schemaname,
    tablename,
    'Has realtime enabled' as status
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;

-- Solution 3: Optimize commonly subscribed tables
-- Add covering indexes for realtime filtering

-- Orders table (likely has realtime subscriptions)
CREATE INDEX IF NOT EXISTS idx_orders_realtime_filter 
ON orders(talent_id, user_id, status, updated_at) 
WHERE status IN ('pending', 'in_progress', 'completed');

-- Notifications table (likely has realtime subscriptions)
CREATE INDEX IF NOT EXISTS idx_notifications_realtime_filter 
ON notifications(user_id, is_read, created_at) 
WHERE is_read = false;

-- Solution 4: Check if we're over-subscribing
-- List all active realtime connections
SELECT 
    COUNT(*) as active_realtime_connections,
    'If this number is high (>1000), consider reducing subscriptions' as recommendation
FROM pg_stat_activity
WHERE application_name LIKE '%realtime%';

-- Solution 5: Analyze WAL (Write-Ahead Log) size
-- Large WAL can slow down realtime.list_changes()
SELECT 
    pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), '0/0')) as wal_size,
    'If this is >10GB, consider checkpoint tuning' as recommendation;

-- Solution 6: Check for table bloat (can slow realtime queries)
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
    n_dead_tup as dead_tuples,
    CASE 
        WHEN n_live_tup > 0 
        THEN ROUND(100.0 * n_dead_tup / (n_live_tup + n_dead_tup), 2)
        ELSE 0
    END as dead_tuple_percent
FROM pg_stat_user_tables
WHERE schemaname = 'public'
AND tablename IN ('orders', 'notifications', 'talent_profiles', 'users')
ORDER BY dead_tuple_percent DESC;

-- Solution 7: Vacuum tables with high dead tuple ratio
-- Run this if dead_tuple_percent > 10%
VACUUM ANALYZE orders;
VACUUM ANALYZE notifications;
VACUUM ANALYZE talent_profiles;
VACUUM ANALYZE users;

-- Solution 8: Check realtime publication settings
-- See which columns are being replicated
SELECT 
    schemaname,
    tablename,
    attnames as replicated_columns
FROM pg_publication_tables pt
LEFT JOIN pg_publication_rel pr ON pt.schemaname = pr.prnamespace::regnamespace::text
    AND pt.tablename = pr.prrelid::regclass::text
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;

-- ============================================
-- FRONTEND OPTIMIZATION RECOMMENDATIONS
-- ============================================
-- These should be implemented in React code:

-- 1. Reduce subscription scope
-- Instead of: supabase.from('orders').on('*', callback)
-- Use: supabase.from('orders').on('UPDATE', callback).eq('status', 'pending')

-- 2. Unsubscribe when components unmount
-- Always call subscription.unsubscribe() in useEffect cleanup

-- 3. Use selective column subscriptions
-- Instead of SELECT *, only select needed columns

-- 4. Batch realtime updates with debouncing
-- Don't re-render on every change, batch them with 500ms delay

-- 5. Consider polling for non-critical data
-- Not everything needs realtime - some data can use 30s polling

-- ============================================
-- MONITORING QUERIES
-- ============================================

-- Check current slow queries in real-time
SELECT 
    pid,
    now() - query_start as duration,
    state,
    query
FROM pg_stat_activity
WHERE state != 'idle'
AND query NOT LIKE '%pg_stat_activity%'
ORDER BY duration DESC
LIMIT 10;

-- Check table statistics
SELECT 
    schemaname,
    tablename,
    seq_scan as sequential_scans,
    seq_tup_read as rows_read_sequentially,
    idx_scan as index_scans,
    idx_tup_fetch as rows_fetched_by_index,
    CASE 
        WHEN seq_scan + idx_scan > 0
        THEN ROUND(100.0 * idx_scan / (seq_scan + idx_scan), 2)
        ELSE 0
    END as index_usage_percent
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY seq_scan DESC;

-- Final recommendations
SELECT 
    '✅ Indexes created for realtime optimization' as status,
    'Next steps:' as action,
    string_agg(recommendation, E'\n') as recommendations
FROM (
    VALUES 
        ('1. Review frontend realtime subscriptions - reduce scope'),
        ('2. Check for table bloat and vacuum if needed'),
        ('3. Monitor realtime connection count'),
        ('4. Consider moving non-critical updates to polling'),
        ('5. Ensure all subscriptions unsubscribe on unmount')
) AS t(recommendation);


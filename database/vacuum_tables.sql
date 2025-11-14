-- Vacuum Tables for Performance
-- Run this SEPARATELY after optimize_realtime_performance.sql
-- VACUUM cannot run inside a transaction block

-- Important: Run these one at a time if needed
-- Only vacuum if dead_tuple_percent > 10% from previous check

-- Vacuum and analyze main tables
VACUUM ANALYZE orders;

VACUUM ANALYZE notifications;

VACUUM ANALYZE talent_profiles;

VACUUM ANALYZE users;

VACUUM ANALYZE help_messages;

VACUUM ANALYZE reviews;

VACUUM ANALYZE payouts;

VACUUM ANALYZE payout_batches;

-- Verify the vacuum worked
SELECT 
    schemaname,
    relname as tablename,
    n_dead_tup as dead_tuples_after_vacuum,
    n_live_tup as live_tuples,
    CASE 
        WHEN n_live_tup > 0 
        THEN ROUND(100.0 * n_dead_tup / (n_live_tup + n_dead_tup), 2)
        ELSE 0
    END as dead_tuple_percent_after
FROM pg_stat_user_tables
WHERE schemaname = 'public'
AND relname IN ('orders', 'notifications', 'talent_profiles', 'users', 'help_messages', 'reviews', 'payouts', 'payout_batches')
ORDER BY dead_tuple_percent_after DESC;

-- Success message
SELECT 
    '✅ Vacuum completed successfully' as status,
    'Check dead_tuple_percent_after - should be close to 0%' as note;


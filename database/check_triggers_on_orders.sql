-- Check for triggers on orders table that might update talent_profiles

SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement,
    action_timing
FROM information_schema.triggers
WHERE event_object_table = 'orders'
ORDER BY trigger_name;

-- Also check functions that might be called by triggers
SELECT 
    proname as function_name,
    prosrc as function_code
FROM pg_proc
WHERE proname LIKE '%order%' OR proname LIKE '%talent%'
ORDER BY proname;


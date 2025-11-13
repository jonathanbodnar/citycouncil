-- Check what order amounts SHOULD be based on talent pricing

SELECT 
    tp.username,
    tp.temp_full_name,
    tp.pricing as talent_rate,
    o.id,
    SUBSTRING(o.id::text, 1, 8) as order_short_id,
    o.amount as current_db_amount,
    o.created_at::date as order_date
FROM orders o
JOIN talent_profiles tp ON tp.id = o.talent_id
WHERE tp.username IN ('shawnfarash', 'joshfirestine', 'jonathanbodnar', 'geraldmorgan')
ORDER BY tp.username, o.created_at;


-- Check actual pricing values in database

-- Check talent_profiles pricing field
SELECT 
    'Talent Pricing Values' as check_type,
    temp_full_name as talent_name,
    pricing,
    corporate_pricing,
    base_pricing
FROM talent_profiles
WHERE is_active = true
LIMIT 5;

-- Check recent order amounts
SELECT 
    'Recent Order Amounts' as check_type,
    o.id,
    o.amount as amount_in_db,
    o.amount / 100.0 as amount_dollars,
    o.admin_fee as admin_fee_in_db,
    o.admin_fee / 100.0 as admin_fee_dollars,
    tp.temp_full_name as talent_name,
    tp.pricing as talent_pricing_field
FROM orders o
LEFT JOIN talent_profiles tp ON tp.id = o.talent_id
ORDER BY o.created_at DESC
LIMIT 5;


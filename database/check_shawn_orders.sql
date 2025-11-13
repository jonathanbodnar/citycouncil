-- Check Shawn Farash's fulfilled orders and promo status

-- 1. Check Shawn's talent profile
SELECT 
    tp.id,
    tp.username,
    tp.temp_full_name,
    tp.fulfilled_orders,
    tp.first_orders_promo_active,
    tp.admin_fee_percentage,
    tp.created_at
FROM talent_profiles tp
WHERE tp.username = 'shawnfarash';

-- 2. Check Shawn's actual completed orders
SELECT 
    o.id,
    o.status,
    o.created_at,
    o.video_url,
    CASE 
        WHEN o.video_url IS NOT NULL AND o.video_url != '' THEN 'Has Video'
        ELSE 'No Video'
    END as video_status
FROM orders o
JOIN talent_profiles tp ON tp.id = o.talent_id
WHERE tp.username = 'shawnfarash'
ORDER BY o.created_at DESC;

-- 3. Count completed orders by status
SELECT 
    o.status,
    COUNT(*) as count
FROM orders o
JOIN talent_profiles tp ON tp.id = o.talent_id
WHERE tp.username = 'shawnfarash'
GROUP BY o.status;


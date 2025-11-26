-- Check Rick Brandelli's orders and potential download issues

-- Step 1: Find Rick Brandelli's user account
SELECT 
    'Rick Brandelli User Info' AS info,
    id,
    email,
    full_name,
    user_type,
    created_at
FROM 
    users
WHERE 
    full_name ILIKE '%rick%brandelli%'
    OR email ILIKE '%rick%'
    OR email ILIKE '%brandelli%';

-- Step 2: Check his orders
SELECT 
    'Rick Brandelli Orders' AS info,
    o.id,
    o.status,
    o.created_at,
    o.video_url,
    o.user_id,
    tp.full_name as talent_name,
    u.email as user_email,
    u.full_name as user_full_name
FROM 
    orders o
JOIN 
    users u ON o.user_id = u.id
JOIN 
    talent_profiles tp ON o.talent_id = tp.id
WHERE 
    u.full_name ILIKE '%rick%brandelli%'
    OR u.email ILIKE '%rick%'
ORDER BY 
    o.created_at DESC;

-- Step 3: Check if there are any orders where user_id doesn't match
SELECT 
    'Potential Mismatched Orders' AS info,
    o.id,
    o.user_id as order_user_id,
    o.status,
    o.video_url IS NOT NULL as has_video,
    tp.full_name as talent_name
FROM 
    orders o
JOIN 
    talent_profiles tp ON o.talent_id = tp.id
WHERE 
    o.status = 'completed'
    AND o.video_url IS NOT NULL
LIMIT 10;

-- Step 4: Check RLS policies on orders table
SELECT 
    'RLS Policies on Orders' AS info,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM 
    pg_policies 
WHERE 
    tablename = 'orders'
ORDER BY 
    policyname;

SELECT '✅ Investigation complete. Check if Rick Brandelli user_id matches the order user_id.' AS result;


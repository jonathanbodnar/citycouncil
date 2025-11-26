-- Delete JP Sears' entire account so he can start fresh with onboarding
-- Username: jpsears
-- This will remove everything and allow him to re-register

-- Step 1: Find JP Sears' account info
SELECT 
    '1. JP SEARS ACCOUNT INFO' AS step,
    tp.id as talent_id,
    tp.username,
    tp.full_name,
    u.id as user_id,
    u.email,
    u.phone,
    u.user_type,
    tp.is_active,
    tp.created_at
FROM 
    talent_profiles tp
JOIN 
    users u ON tp.user_id = u.id
WHERE 
    tp.username = 'jpsears';

-- Step 2: Check for any orders (should be none or only demo)
SELECT 
    '2. JP SEARS ORDERS' AS step,
    o.id,
    o.status,
    o.amount / 100.0 as amount_dollars,
    o.request_details,
    customer.email as customer_email
FROM 
    orders o
JOIN 
    talent_profiles tp ON o.talent_id = tp.id
JOIN 
    users customer ON o.user_id = customer.id
WHERE 
    tp.username = 'jpsears'
ORDER BY 
    o.created_at DESC;

-- =====================================================================================================
-- DELETE EVERYTHING FOR JP SEARS
-- =====================================================================================================

-- Step 3: Delete notifications related to this talent
DELETE FROM notifications
WHERE user_id IN (
    SELECT u.id FROM talent_profiles tp
    JOIN users u ON tp.user_id = u.id
    WHERE tp.username = 'jpsears'
);

-- Step 4: Delete payouts for this talent
DELETE FROM payouts
WHERE talent_id IN (
    SELECT id FROM talent_profiles WHERE username = 'jpsears'
);

-- Step 5: Delete payout_batches for this talent
DELETE FROM payout_batches
WHERE talent_id IN (
    SELECT id FROM talent_profiles WHERE username = 'jpsears'
);

-- Step 6: Delete orders for this talent
DELETE FROM orders
WHERE talent_id IN (
    SELECT id FROM talent_profiles WHERE username = 'jpsears'
);

-- Step 7: Delete talent_profiles record
DELETE FROM talent_profiles
WHERE username = 'jpsears';

-- Step 8: Delete from public.users
DELETE FROM public.users
WHERE id IN (
    SELECT tp.user_id FROM talent_profiles tp WHERE tp.username = 'jpsears'
);

-- Note: We cannot delete from auth.users via SQL
-- You must delete from auth.users manually in Supabase Dashboard

-- Step 9: Delete any beta_signups with his phone
DELETE FROM beta_signups
WHERE phone_number IN ('7604209593', '+17604209593', '17604209593')
   OR phone_number LIKE '%7604209593%';

-- =====================================================================================================
-- VERIFICATION
-- =====================================================================================================

-- Step 10: Verify talent_profiles is deleted
SELECT 
    '✅ VERIFICATION: talent_profiles' AS check,
    COUNT(*) as remaining_count
FROM 
    talent_profiles
WHERE 
    username = 'jpsears';

-- Step 11: Verify public.users is deleted
SELECT 
    '✅ VERIFICATION: public.users' AS check,
    COUNT(*) as remaining_count
FROM 
    public.users u
WHERE 
    u.email LIKE '%jpsears%' OR u.email LIKE '%jp%sears%';

-- Step 12: Verify orders are deleted
SELECT 
    '✅ VERIFICATION: orders' AS check,
    COUNT(*) as remaining_count
FROM 
    orders o
WHERE 
    o.talent_id IN (SELECT id FROM talent_profiles WHERE username = 'jpsears');

SELECT '✅ JP Sears account deleted from database!' AS result;
SELECT '⚠️ IMPORTANT: You must also delete his account from Supabase Dashboard → Authentication → Users' AS reminder;
SELECT 'Search for his email and delete the auth.users record manually' AS instructions;


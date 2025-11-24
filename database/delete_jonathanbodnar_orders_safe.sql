-- Safely delete all orders for jonathanbodnar and related data
-- This will cascade through payouts, reviews, and other related records

BEGIN;

-- Get Jonathan's IDs
DO $$
DECLARE
    v_user_id UUID;
    v_talent_id UUID;
BEGIN
    -- Get user ID
    SELECT id INTO v_user_id
    FROM users
    WHERE email = 'jb@apollo.inc';
    
    -- Get talent ID
    SELECT id INTO v_talent_id
    FROM talent_profiles
    WHERE username = 'jonathanbodnar';
    
    RAISE NOTICE 'User ID: %', v_user_id;
    RAISE NOTICE 'Talent ID: %', v_talent_id;
    
    -- Show what will be deleted
    RAISE NOTICE '=== ORDERS AS CUSTOMER ===';
    RAISE NOTICE 'Orders where Jonathan is the customer: %', 
        (SELECT COUNT(*) FROM orders WHERE user_id = v_user_id);
    
    RAISE NOTICE '=== ORDERS AS TALENT ===';
    RAISE NOTICE 'Orders where Jonathan is the talent: %', 
        (SELECT COUNT(*) FROM orders WHERE talent_id = v_talent_id);
    
    RAISE NOTICE '=== PAYOUTS ===';
    RAISE NOTICE 'Payouts for Jonathan: %', 
        (SELECT COUNT(*) FROM payouts WHERE talent_id = v_talent_id);
    
    RAISE NOTICE '=== PAYOUT BATCHES ===';
    RAISE NOTICE 'Payout batches for Jonathan: %', 
        (SELECT COUNT(*) FROM payout_batches WHERE talent_id = v_talent_id);
    
    RAISE NOTICE '=== REVIEWS ===';
    RAISE NOTICE 'Reviews by Jonathan: %', 
        (SELECT COUNT(*) FROM reviews WHERE user_id = v_user_id);
    RAISE NOTICE 'Reviews for Jonathan: %', 
        (SELECT COUNT(*) FROM reviews WHERE talent_id = v_talent_id);
    
    RAISE NOTICE '=== NOTIFICATIONS ===';
    RAISE NOTICE 'Notifications for Jonathan orders: %', 
        (SELECT COUNT(*) FROM notifications WHERE order_id IN (
            SELECT id FROM orders 
            WHERE user_id = v_user_id OR talent_id = v_talent_id
        ));
END $$;

-- Delete in correct order to avoid foreign key violations

-- 1. Delete notifications related to Jonathan's orders
DELETE FROM notifications
WHERE order_id IN (
    SELECT id FROM orders 
    WHERE user_id = (SELECT id FROM users WHERE email = 'jb@apollo.inc')
       OR talent_id = (SELECT id FROM talent_profiles WHERE username = 'jonathanbodnar')
);

-- 2. Delete payout batches
DELETE FROM payout_batches
WHERE talent_id = (SELECT id FROM talent_profiles WHERE username = 'jonathanbodnar');

-- 3. Delete payouts
DELETE FROM payouts
WHERE talent_id = (SELECT id FROM talent_profiles WHERE username = 'jonathanbodnar');

-- 4. Delete reviews related to Jonathan's orders
DELETE FROM reviews
WHERE order_id IN (
    SELECT id FROM orders 
    WHERE user_id = (SELECT id FROM users WHERE email = 'jb@apollo.inc')
       OR talent_id = (SELECT id FROM talent_profiles WHERE username = 'jonathanbodnar')
);

-- 5. Delete orders where Jonathan is the customer
DELETE FROM orders
WHERE user_id = (SELECT id FROM users WHERE email = 'jb@apollo.inc');

-- 6. Delete orders where Jonathan is the talent
DELETE FROM orders
WHERE talent_id = (SELECT id FROM talent_profiles WHERE username = 'jonathanbodnar');

-- 6. Reset Jonathan's talent profile stats
UPDATE talent_profiles
SET 
    fulfilled_orders = 0,
    total_earnings = 0,
    updated_at = NOW()
WHERE username = 'jonathanbodnar';

-- Verify deletion
SELECT 
    'AFTER DELETION' as status,
    (SELECT COUNT(*) FROM orders WHERE user_id = (SELECT id FROM users WHERE email = 'jb@apollo.inc')) as orders_as_customer,
    (SELECT COUNT(*) FROM orders WHERE talent_id = (SELECT id FROM talent_profiles WHERE username = 'jonathanbodnar')) as orders_as_talent,
    (SELECT COUNT(*) FROM payouts WHERE talent_id = (SELECT id FROM talent_profiles WHERE username = 'jonathanbodnar')) as payouts,
    (SELECT COUNT(*) FROM payout_batches WHERE talent_id = (SELECT id FROM talent_profiles WHERE username = 'jonathanbodnar')) as batches,
    (SELECT fulfilled_orders FROM talent_profiles WHERE username = 'jonathanbodnar') as fulfilled_orders,
    (SELECT total_earnings FROM talent_profiles WHERE username = 'jonathanbodnar') as total_earnings;

COMMIT;

-- Final message
SELECT '✅ Successfully deleted all orders and related data for jonathanbodnar' as result;


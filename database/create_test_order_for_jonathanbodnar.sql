-- Create a test order for jonathanbodnar talent to test video upload
-- This creates a pending order that can be used to test the upload flow

-- Step 1: Find jonathanbodnar's talent_id and user_id
SELECT 
    '1. JONATHANBODNAR INFO' AS step,
    tp.id as talent_id,
    tp.user_id,
    u.email,
    tp.full_name,
    tp.pricing as talent_pricing
FROM 
    talent_profiles tp
JOIN 
    users u ON tp.user_id = u.id
WHERE 
    u.email LIKE '%jonathanbodnar%' OR u.email = 'jb@apollo.inc';

-- Step 2: Find a test customer (or use admin)
SELECT 
    '2. TEST CUSTOMER' AS step,
    id as customer_id,
    email,
    full_name
FROM 
    users
WHERE 
    email = 'hi@gmail.com' OR email LIKE '%test%'
LIMIT 5;

-- Step 3: Create the test order
-- NOTE: Uncomment the INSERT below after verifying the IDs above

-- INSERT INTO orders (
--     user_id,
--     talent_id,
--     request_details,
--     amount,
--     admin_fee,
--     charity_amount,
--     fulfillment_deadline,
--     payment_transaction_id,
--     status,
--     is_corporate,
--     approval_status,
--     approved_at,
--     created_at
-- )
-- VALUES (
--     (SELECT id FROM users WHERE email = 'hi@gmail.com' LIMIT 1), -- Customer
--     (SELECT tp.id FROM talent_profiles tp JOIN users u ON tp.user_id = u.id WHERE u.email = 'jb@apollo.inc' LIMIT 1), -- Jonathanbodnar talent
--     'Test order for video upload testing. Please record a quick test video.',
--     10000, -- $100.00 in cents
--     2500, -- $25.00 admin fee
--     0, -- No charity
--     NOW() + INTERVAL '7 days', -- 7 days to fulfill
--     'TEST_' || EXTRACT(EPOCH FROM NOW())::TEXT, -- Unique transaction ID
--     'in_progress', -- Set to in_progress so it's ready for upload
--     false, -- Not corporate
--     'approved', -- Already approved
--     NOW(),
--     NOW()
-- );

-- Step 4: Verify the test order was created
-- SELECT 
--     '4. TEST ORDER CREATED' AS step,
--     o.id as order_id,
--     o.status,
--     o.amount / 100.0 as amount_dollars,
--     o.request_details,
--     tp.full_name as talent_name,
--     customer.email as customer_email
-- FROM 
--     orders o
-- JOIN 
--     talent_profiles tp ON o.talent_id = tp.id
-- JOIN 
--     users customer ON o.user_id = customer.id
-- WHERE 
--     o.payment_transaction_id LIKE 'TEST_%'
-- ORDER BY 
--     o.created_at DESC
-- LIMIT 5;

SELECT '✅ Review the IDs above, then uncomment the INSERT statement to create the test order.' AS instructions;


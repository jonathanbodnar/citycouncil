-- Automatically create a test order for jonathanbodnar talent
-- This creates an in_progress order ready for video upload testing

DO $$
DECLARE
    v_talent_id UUID;
    v_customer_id UUID;
    v_order_id UUID;
    v_talent_pricing INTEGER;
BEGIN
    -- Get jonathanbodnar's talent profile
    SELECT tp.id, tp.pricing INTO v_talent_id, v_talent_pricing
    FROM talent_profiles tp
    JOIN users u ON tp.user_id = u.id
    WHERE u.email = 'jb@apollo.inc'
    LIMIT 1;

    IF v_talent_id IS NULL THEN
        RAISE EXCEPTION 'Could not find jonathanbodnar talent profile (jb@apollo.inc)';
    END IF;

    -- Get a test customer (use hi@gmail.com or any user)
    SELECT id INTO v_customer_id
    FROM users
    WHERE email = 'hi@gmail.com'
    LIMIT 1;

    IF v_customer_id IS NULL THEN
        -- If hi@gmail.com doesn't exist, use any non-talent user
        SELECT id INTO v_customer_id
        FROM users
        WHERE user_type = 'user'
        LIMIT 1;
    END IF;

    IF v_customer_id IS NULL THEN
        RAISE EXCEPTION 'Could not find a customer user for test order';
    END IF;

    -- Create the test order
    INSERT INTO orders (
        user_id,
        talent_id,
        request_details,
        amount,
        admin_fee,
        charity_amount,
        fulfillment_deadline,
        payment_transaction_id,
        status,
        is_corporate,
        approval_status,
        approved_at,
        created_at
    )
    VALUES (
        v_customer_id,
        v_talent_id,
        'Test order for video upload and RLS testing. Record a quick 10-second test video.',
        COALESCE(v_talent_pricing, 10000), -- Use talent pricing or default $100
        COALESCE(v_talent_pricing, 10000) * 0.25, -- 25% admin fee
        0, -- No charity
        NOW() + INTERVAL '7 days',
        'TEST_UPLOAD_' || EXTRACT(EPOCH FROM NOW())::TEXT,
        'in_progress', -- Ready for upload
        false,
        'approved',
        NOW(),
        NOW()
    )
    RETURNING id INTO v_order_id;

    RAISE NOTICE '✅ Test order created successfully!';
    RAISE NOTICE 'Order ID: %', v_order_id;
    RAISE NOTICE 'Talent: jonathanbodnar (jb@apollo.inc)';
    RAISE NOTICE 'Status: in_progress (ready for video upload)';
    RAISE NOTICE 'Amount: $%.2f', (COALESCE(v_talent_pricing, 10000) / 100.0);

END $$;

-- Show the newly created test order
SELECT 
    '✅ TEST ORDER DETAILS' AS status,
    o.id as order_id,
    o.status,
    o.amount / 100.0 as amount_dollars,
    o.admin_fee / 100.0 as admin_fee_dollars,
    o.request_details,
    tp.full_name as talent_name,
    tp.username as talent_username,
    customer.email as customer_email,
    o.fulfillment_deadline,
    o.payment_transaction_id
FROM 
    orders o
JOIN 
    talent_profiles tp ON o.talent_id = tp.id
JOIN 
    users u ON tp.user_id = u.id
JOIN 
    users customer ON o.user_id = customer.id
WHERE 
    u.email = 'jb@apollo.inc'
    AND o.payment_transaction_id LIKE 'TEST_UPLOAD_%'
ORDER BY 
    o.created_at DESC
LIMIT 1;


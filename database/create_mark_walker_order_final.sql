-- Create Mark Walker's order for Gerald Morgan
-- Transaction ID: 31f0cbd4d2f5fdd8acea628c
-- Customer Email: trainleader21@gmail.com
-- Talent: Gerald Morgan
-- Amount: $48.36 (base $47.00 + 2.9% processing fee)
-- Admin Fee: $11.75 (25% of $47.00)
-- Created: Nov 28, 2025 05:08:05 UTC

DO $$
DECLARE
    _user_id UUID;
    _talent_id UUID;
    _order_id UUID;
    _customer_full_name TEXT;
    _talent_full_name TEXT;
    _order_amount_cents BIGINT := 4836; -- $48.36 * 100
    _admin_fee_cents BIGINT := 1175;    -- $11.75 * 100
    _transaction_id TEXT := '31f0cbd4d2f5fdd8acea628c';
    _request_details TEXT := 'Heyy Gerald, I am a huge fan of the show!

Could you record a short holiday greeting — something warm and cheerful, wishing the viewer a joyful season, blessings, and a happy new year. Feel free to say ''God bless you'' or share general good wishes in a friendly and uplifting tone.';
    _created_at TIMESTAMP WITH TIME ZONE := '2025-11-28 05:08:05+00';
    _fulfillment_deadline TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Get user_id for Mark Walker
    SELECT id, full_name INTO _user_id, _customer_full_name
    FROM public.users
    WHERE email = 'trainleader21@gmail.com';

    IF _user_id IS NULL THEN
        RAISE EXCEPTION 'User trainleader21@gmail.com not found. Cannot create order.';
    END IF;

    -- Get talent_id for Gerald Morgan
    SELECT tp.id, u.full_name INTO _talent_id, _talent_full_name
    FROM public.talent_profiles tp
    JOIN public.users u ON tp.user_id = u.id
    WHERE u.full_name = 'Gerald Morgan';

    IF _talent_id IS NULL THEN
        RAISE EXCEPTION 'Talent Gerald Morgan not found. Cannot create order.';
    END IF;

    -- Check if an order with this transaction ID already exists
    SELECT id INTO _order_id
    FROM public.orders
    WHERE payment_transaction_id = _transaction_id;

    IF _order_id IS NOT NULL THEN
        RAISE EXCEPTION 'Order with transaction ID % already exists (Order ID: %). Aborting manual creation.', _transaction_id, _order_id;
    END IF;

    -- Calculate fulfillment deadline (48 hours from _created_at)
    _fulfillment_deadline := _created_at + INTERVAL '48 hours';

    -- Insert the order
    INSERT INTO public.orders (
        user_id, talent_id, request_details, amount, admin_fee,
        fulfillment_deadline, payment_transaction_id, status, created_at,
        is_corporate, is_corporate_order, approval_status, approved_at
    ) VALUES (
        _user_id, _talent_id, _request_details, _order_amount_cents, _admin_fee_cents,
        _fulfillment_deadline, _transaction_id, 'pending', _created_at,
        FALSE, FALSE, 'approved', _created_at -- Personal order, approved immediately
    ) RETURNING id INTO _order_id;

    RAISE NOTICE '✅ Order created successfully! Order ID: %', _order_id;

    -- Create notification for the user (Mark Walker)
    INSERT INTO public.notifications (user_id, order_id, type, message, is_read)
    VALUES (
        _user_id,
        _order_id,
        'order_placed',
        'Your ShoutOut order from ' || _talent_full_name || ' has been placed!',
        FALSE
    );
    RAISE NOTICE '✅ Notification created for user %', _customer_full_name;

    -- Create notification for the talent (Gerald Morgan)
    INSERT INTO public.notifications (user_id, order_id, type, message, is_read)
    VALUES (
        (SELECT user_id FROM public.talent_profiles WHERE id = _talent_id),
        _order_id,
        'order_placed',
        'You have a new ShoutOut order from ' || _customer_full_name || '!',
        FALSE
    );
    RAISE NOTICE '✅ Notification created for talent %', _talent_full_name;

    RAISE NOTICE '';
    RAISE NOTICE '=== ORDER CREATED SUCCESSFULLY ===';
    RAISE NOTICE 'Order ID: %', _order_id;
    RAISE NOTICE 'Customer: % (%)', _customer_full_name, 'trainleader21@gmail.com';
    RAISE NOTICE 'Talent: %', _talent_full_name;
    RAISE NOTICE 'Amount: $%.2f', _order_amount_cents::NUMERIC / 100;
    RAISE NOTICE 'Status: pending';
    RAISE NOTICE '';

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error during manual order creation: %', SQLERRM;
END $$;


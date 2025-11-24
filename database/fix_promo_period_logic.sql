-- Check current promo status for Larry, Nick, and Jonathan
SELECT 
    tp.username,
    tp.first_orders_promo_active,
    tp.fulfilled_orders,
    CASE 
        WHEN tp.first_orders_promo_active AND tp.fulfilled_orders < 10 THEN 'Should be 0% fee'
        ELSE 'Should charge fee'
    END as expected_fee
FROM talent_profiles tp
WHERE tp.username IN ('larryelder', 'nickdipaolo', 'jonathanbodnar');

-- Check their payouts
SELECT 
    tp.username,
    o.id as order_id,
    o.amount as order_cents,
    p.order_amount,
    p.admin_fee_percentage,
    p.payout_amount,
    o.created_at
FROM orders o
JOIN talent_profiles tp ON tp.id = o.talent_id
LEFT JOIN payouts p ON p.order_id = o.id
WHERE tp.username IN ('larryelder', 'nickdipaolo', 'jonathanbodnar')
  AND o.created_at::date = CURRENT_DATE
ORDER BY o.created_at DESC;

-- Fix the trigger to check fulfilled_orders BEFORE the current order
DROP FUNCTION IF EXISTS create_payout_on_order_completion() CASCADE;

CREATE OR REPLACE FUNCTION create_payout_on_order_completion()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    v_talent_profile RECORD;
    v_base_price NUMERIC(10,2);
    v_admin_fee_pct NUMERIC(5,2);
    v_admin_fee_amount NUMERIC(10,2);
    v_payout_amount NUMERIC(10,2);
    v_week_start DATE;
    v_week_end DATE;
    v_completed_orders_before_this INTEGER;
BEGIN
    -- Only process completed orders
    IF NEW.status != 'completed' THEN
        RETURN NEW;
    END IF;

    -- Get talent profile
    SELECT * INTO v_talent_profile
    FROM talent_profiles
    WHERE id = NEW.talent_id;

    IF NOT FOUND THEN
        RAISE WARNING 'Talent profile not found for order %', NEW.id;
        RETURN NEW;
    END IF;

    -- Count how many orders this talent has completed BEFORE this one
    SELECT COUNT(*) INTO v_completed_orders_before_this
    FROM orders
    WHERE talent_id = NEW.talent_id
      AND status = 'completed'
      AND id != NEW.id
      AND created_at < NEW.created_at;

    -- *** CRITICAL: orders.amount is in CENTS, divide by 100 first! ***
    v_base_price := (NEW.amount / 100.0) / 1.029;

    -- Determine admin fee based on orders completed BEFORE this one
    IF v_talent_profile.first_orders_promo_active AND v_completed_orders_before_this < 10 THEN
        -- Promo period: 0% fee for first 10 orders
        v_admin_fee_pct := 0;
        v_admin_fee_amount := 0;
        v_payout_amount := v_base_price;
        
        RAISE NOTICE 'Promo fee applied for talent % with % prior orders', 
            v_talent_profile.username, v_completed_orders_before_this;
    ELSE
        -- Use order's stored admin_fee or talent's current percentage
        IF NEW.admin_fee IS NOT NULL AND NEW.admin_fee > 0 AND NEW.admin_fee <= 100 THEN
            v_admin_fee_pct := NEW.admin_fee;
        ELSE
            v_admin_fee_pct := COALESCE(v_talent_profile.admin_fee_percentage, 25);
        END IF;
        
        v_admin_fee_amount := v_base_price * (v_admin_fee_pct / 100.0);
        v_payout_amount := v_base_price - v_admin_fee_amount;
        
        RAISE NOTICE 'Admin fee applied for talent % with % prior orders', 
            v_talent_profile.username, v_completed_orders_before_this;
    END IF;

    -- Calculate week boundaries
    v_week_start := DATE_TRUNC('week', NEW.created_at)::DATE + 1;
    v_week_end := v_week_start + 6;

    -- Insert or update payout
    INSERT INTO payouts (
        id,
        talent_id,
        order_id,
        week_start_date,
        week_end_date,
        order_amount,
        admin_fee_percentage,
        admin_fee_amount,
        payout_amount,
        status,
        is_refunded,
        created_at,
        updated_at
    ) VALUES (
        gen_random_uuid(),
        NEW.talent_id,
        NEW.id,
        v_week_start,
        v_week_end,
        v_base_price,
        v_admin_fee_pct,
        v_admin_fee_amount,
        v_payout_amount,
        'pending',
        false,
        NOW(),
        NOW()
    )
    ON CONFLICT (order_id) DO UPDATE SET
        order_amount = v_base_price,
        admin_fee_percentage = v_admin_fee_pct,
        admin_fee_amount = v_admin_fee_amount,
        payout_amount = v_payout_amount,
        updated_at = NOW();

    -- Update batch
    INSERT INTO payout_batches (
        id,
        talent_id,
        week_start_date,
        week_end_date,
        total_orders,
        total_payout_amount,
        total_refunded_amount,
        net_payout_amount,
        status,
        created_at,
        updated_at
    )
    SELECT 
        gen_random_uuid(),
        NEW.talent_id,
        v_week_start,
        v_week_end,
        COUNT(*)::INTEGER,
        SUM(p.payout_amount),
        0,
        SUM(p.payout_amount),
        'pending',
        NOW(),
        NOW()
    FROM payouts p
    WHERE p.talent_id = NEW.talent_id
      AND p.week_start_date = v_week_start
      AND NOT p.is_refunded
    ON CONFLICT (talent_id, week_start_date) DO UPDATE SET
        total_orders = (
            SELECT COUNT(*)::INTEGER
            FROM payouts p
            WHERE p.talent_id = NEW.talent_id
              AND p.week_start_date = v_week_start
        ),
        total_payout_amount = (
            SELECT COALESCE(SUM(p.payout_amount), 0)
            FROM payouts p
            WHERE p.talent_id = NEW.talent_id
              AND p.week_start_date = v_week_start
              AND NOT p.is_refunded
        ),
        total_refunded_amount = (
            SELECT COALESCE(SUM(p.payout_amount), 0)
            FROM payouts p
            WHERE p.talent_id = NEW.talent_id
              AND p.week_start_date = v_week_start
              AND p.is_refunded
        ),
        net_payout_amount = (
            SELECT COALESCE(SUM(CASE WHEN p.is_refunded THEN 0 ELSE p.payout_amount END), 0)
            FROM payouts p
            WHERE p.talent_id = NEW.talent_id
              AND p.week_start_date = v_week_start
        ),
        updated_at = NOW();

    -- Update talent total earnings
    UPDATE talent_profiles
    SET total_earnings = (
        SELECT COALESCE(SUM(p.payout_amount), 0)
        FROM payouts p
        WHERE p.talent_id = NEW.talent_id
          AND NOT p.is_refunded
    )
    WHERE id = NEW.talent_id;

    RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS trigger_create_payout_on_completion ON orders;
CREATE TRIGGER trigger_create_payout_on_completion
    AFTER INSERT OR UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION create_payout_on_order_completion();

-- Now manually fix today's payouts for Larry, Nick, and Jonathan
DO $$
DECLARE
    v_order RECORD;
    v_talent RECORD;
    v_base_price NUMERIC(10,2);
    v_completed_before INTEGER;
BEGIN
    FOR v_order IN 
        SELECT o.*, p.id as payout_id
        FROM orders o
        JOIN talent_profiles tp ON tp.id = o.talent_id
        LEFT JOIN payouts p ON p.order_id = o.id
        WHERE tp.username IN ('larryelder', 'nickdipaolo', 'jonathanbodnar')
          AND o.created_at::date = CURRENT_DATE
          AND o.status = 'completed'
    LOOP
        -- Get talent
        SELECT * INTO v_talent FROM talent_profiles WHERE id = v_order.talent_id;
        
        -- Count orders before this one
        SELECT COUNT(*) INTO v_completed_before
        FROM orders
        WHERE talent_id = v_order.talent_id
          AND status = 'completed'
          AND id != v_order.id
          AND created_at < v_order.created_at;
        
        -- Calculate base price
        v_base_price := (v_order.amount / 100.0) / 1.029;
        
        -- Update payout with 0% fee
        IF v_talent.first_orders_promo_active AND v_completed_before < 10 THEN
            UPDATE payouts
            SET 
                order_amount = v_base_price,
                admin_fee_percentage = 0,
                admin_fee_amount = 0,
                payout_amount = v_base_price,
                updated_at = NOW()
            WHERE id = v_order.payout_id;
            
            RAISE NOTICE 'Fixed payout - talent: %, base price: %, prior orders: %',
                v_talent.username, v_base_price, v_completed_before;
        END IF;
    END LOOP;
END $$;

-- Recalculate batch totals
UPDATE payout_batches pb
SET 
    total_payout_amount = (
        SELECT COALESCE(SUM(p.payout_amount), 0)
        FROM payouts p
        WHERE p.talent_id = pb.talent_id
          AND p.week_start_date = pb.week_start_date
          AND NOT p.is_refunded
    ),
    net_payout_amount = (
        SELECT COALESCE(SUM(CASE WHEN p.is_refunded THEN 0 ELSE p.payout_amount END), 0)
        FROM payouts p
        WHERE p.talent_id = pb.talent_id
          AND p.week_start_date = pb.week_start_date
    ),
    updated_at = NOW()
WHERE talent_id IN (
    SELECT id FROM talent_profiles WHERE username IN ('larryelder', 'nickdipaolo', 'jonathanbodnar')
);

-- Verify
SELECT 
    'AFTER FIX' as status,
    tp.username,
    tp.fulfilled_orders,
    o.amount as order_cents,
    p.order_amount as base_price,
    p.admin_fee_percentage as fee_pct,
    p.payout_amount as net_payout,
    pb.net_payout_amount as batch_total
FROM orders o
JOIN talent_profiles tp ON tp.id = o.talent_id
LEFT JOIN payouts p ON p.order_id = o.id
LEFT JOIN payout_batches pb ON pb.talent_id = o.talent_id AND pb.week_start_date = p.week_start_date
WHERE tp.username IN ('larryelder', 'nickdipaolo', 'jonathanbodnar')
  AND o.created_at::date = CURRENT_DATE
ORDER BY o.created_at DESC;


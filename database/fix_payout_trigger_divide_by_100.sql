-- FIX THE PAYOUT TRIGGER TO DIVIDE BY 100 (orders.amount is in CENTS!)
-- This is the DEFINITIVE fix - orders.amount is ALWAYS in cents

DROP FUNCTION IF EXISTS create_payout_on_order_completion() CASCADE;
DROP FUNCTION IF EXISTS handle_order_refund() CASCADE;

-- Recreate the trigger function with CORRECT cents-to-dollars conversion
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

    -- *** CRITICAL: orders.amount is in CENTS, divide by 100 first! ***
    -- Then divide by 1.029 to remove 2.9% processing fee
    v_base_price := (NEW.amount / 100.0) / 1.029;

    -- Determine admin fee
    IF v_talent_profile.first_orders_promo_active AND v_talent_profile.fulfilled_orders < 10 THEN
        -- Promo period: 0% fee
        v_admin_fee_pct := 0;
        v_admin_fee_amount := 0;
        v_payout_amount := v_base_price;
    ELSE
        -- Use order's stored admin_fee or talent's current percentage
        IF NEW.admin_fee IS NOT NULL AND NEW.admin_fee > 0 AND NEW.admin_fee <= 100 THEN
            v_admin_fee_pct := NEW.admin_fee;
        ELSE
            v_admin_fee_pct := COALESCE(v_talent_profile.admin_fee_percentage, 25);
        END IF;
        
        v_admin_fee_amount := v_base_price * (v_admin_fee_pct / 100.0);
        v_payout_amount := v_base_price - v_admin_fee_amount;
    END IF;

    -- Calculate week boundaries (Monday to Sunday)
    v_week_start := DATE_TRUNC('week', NEW.created_at)::DATE + 1;
    v_week_end := v_week_start + 6;

    -- Insert or update payout record
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

    -- Update or create batch
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

-- Refund handler
CREATE OR REPLACE FUNCTION handle_order_refund()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.status = 'refunded' AND OLD.status != 'refunded' THEN
        UPDATE payouts
        SET 
            is_refunded = true,
            refund_reason = 'Order refunded',
            updated_at = NOW()
        WHERE order_id = NEW.id;

        -- Recalculate batch totals
        UPDATE payout_batches pb
        SET 
            total_refunded_amount = (
                SELECT COALESCE(SUM(p.payout_amount), 0)
                FROM payouts p
                WHERE p.talent_id = pb.talent_id
                  AND p.week_start_date = pb.week_start_date
                  AND p.is_refunded
            ),
            net_payout_amount = (
                SELECT COALESCE(SUM(CASE WHEN p.is_refunded THEN 0 ELSE p.payout_amount END), 0)
                FROM payouts p
                WHERE p.talent_id = pb.talent_id
                  AND p.week_start_date = pb.week_start_date
            ),
            updated_at = NOW()
        WHERE talent_id = NEW.talent_id
          AND week_start_date = (DATE_TRUNC('week', NEW.created_at)::DATE + 1);

        -- Update talent total earnings
        UPDATE talent_profiles
        SET total_earnings = (
            SELECT COALESCE(SUM(p.payout_amount), 0)
            FROM payouts p
            WHERE p.talent_id = NEW.talent_id
              AND NOT p.is_refunded
        )
        WHERE id = NEW.talent_id;
    END IF;

    RETURN NEW;
END;
$$;

-- Recreate triggers
DROP TRIGGER IF EXISTS trigger_create_payout_on_completion ON orders;
CREATE TRIGGER trigger_create_payout_on_completion
    AFTER INSERT OR UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION create_payout_on_order_completion();

DROP TRIGGER IF EXISTS trigger_handle_order_refund ON orders;
CREATE TRIGGER trigger_handle_order_refund
    AFTER UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION handle_order_refund();

-- NOW FIX TODAY'S BROKEN PAYOUTS
UPDATE payouts p
SET 
    order_amount = (o.amount / 100.0) / 1.029,
    payout_amount = CASE 
        WHEN p.admin_fee_percentage = 0 THEN (o.amount / 100.0) / 1.029
        ELSE ((o.amount / 100.0) / 1.029) * (1 - p.admin_fee_percentage / 100.0)
    END,
    admin_fee_amount = CASE
        WHEN p.admin_fee_percentage = 0 THEN 0
        ELSE ((o.amount / 100.0) / 1.029) * (p.admin_fee_percentage / 100.0)
    END,
    updated_at = NOW()
FROM orders o
WHERE p.order_id = o.id
  AND o.created_at::date = CURRENT_DATE
  AND p.order_amount > 1000; -- Only fix obviously broken ones

-- Recalculate ALL batch totals
UPDATE payout_batches pb
SET 
    total_payout_amount = (
        SELECT COALESCE(SUM(p.payout_amount), 0)
        FROM payouts p
        WHERE p.talent_id = pb.talent_id
          AND p.week_start_date = pb.week_start_date
          AND NOT p.is_refunded
    ),
    total_refunded_amount = (
        SELECT COALESCE(SUM(p.payout_amount), 0)
        FROM payouts p
        WHERE p.talent_id = pb.talent_id
          AND p.week_start_date = pb.week_start_date
          AND p.is_refunded
    ),
    net_payout_amount = (
        SELECT COALESCE(SUM(CASE WHEN p.is_refunded THEN 0 ELSE p.payout_amount END), 0)
        FROM payouts p
        WHERE p.talent_id = pb.talent_id
          AND p.week_start_date = pb.week_start_date
    ),
    updated_at = NOW();

-- Verify the fix
SELECT 
    'AFTER FIX' as status,
    tp.username,
    o.id as order_id,
    o.amount as order_cents,
    (o.amount / 100.0) as order_dollars,
    p.order_amount as payout_base_price,
    p.payout_amount as payout_amount,
    pb.net_payout_amount as batch_total
FROM orders o
LEFT JOIN payouts p ON p.order_id = o.id
LEFT JOIN talent_profiles tp ON tp.id = o.talent_id
LEFT JOIN payout_batches pb ON pb.talent_id = o.talent_id AND pb.week_start_date = p.week_start_date
WHERE o.created_at::date = CURRENT_DATE
ORDER BY o.created_at DESC;


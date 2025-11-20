-- Fix orders with incorrect cent values
-- These orders have wrong orders.amount - need to correct them based on their intended base prices

BEGIN;

-- Gerald Morgan: stored as 4700 cents ($47), should be 4733 cents ($46 base × 1.029)
-- But wait - user said Gerald's was $47 gross, so 4700 is correct!
-- Actually $47 gross means $45.68 base, which gives us $47.00 gross - this is CORRECT

-- Josh Firestine: stored as 5000 cents ($50), should be 5042 cents ($49 base × 1.029)  
-- User said Josh's was $50 gross, so 5000 is correct!
-- $50 gross means $48.59 base - this is CORRECT

-- Nick DiPaolo: stored as 12500 cents ($125), should be 12451 cents ($121 base × 1.029)
-- User said Nick's first order was $125 gross, so 12500 is correct!
-- $125 gross means $121.48 base - this is CORRECT

-- Nick DiPaolo: stored as 100 cents ($1), should be 103 cents ($1 base × 1.029)
-- This is clearly wrong - likely a test order that was entered as $1
-- Update to correct value
UPDATE orders 
SET amount = 103,
    updated_at = NOW()
WHERE id = 'faced80c-da3d-4af0-bc01-9e76ac83e52d';

-- Shawn Farash: stored as 13700 cents ($137), should be 13686 cents ($133 base × 1.029)
-- User said Shawn's first video was $137 gross, so 13700 is correct!
-- $137 gross means $133.14 base - this is CORRECT

-- Shawn Farash: stored as 11000 cents ($110), should be 11010 cents ($107 base × 1.029)
-- User said Shawn's second video was $110 gross, so 11000 is correct!
-- $110 gross means $106.90 base - this is CORRECT

-- Now recalculate payouts for the one order we fixed
DO $$
DECLARE
    v_order RECORD;
    v_talent_profile RECORD;
    v_base_price NUMERIC(10,2);
    v_admin_fee_pct NUMERIC(5,2);
    v_admin_fee_amount NUMERIC(10,2);
    v_payout_amount NUMERIC(10,2);
BEGIN
    -- Get the order we just fixed
    FOR v_order IN 
        SELECT o.*, p.id as payout_id
        FROM orders o
        LEFT JOIN payouts p ON p.order_id = o.id
        WHERE o.id = 'faced80c-da3d-4af0-bc01-9e76ac83e52d'
    LOOP
        -- Get talent profile for admin fee
        SELECT * INTO v_talent_profile
        FROM talent_profiles
        WHERE id = v_order.talent_id;
        
        -- Calculate base price (remove processing fee)
        v_base_price := (v_order.amount / 100.0) / 1.029;
        
        -- Check if talent is in promo period
        IF v_talent_profile.first_orders_promo_active AND v_talent_profile.fulfilled_orders < 10 THEN
            v_admin_fee_pct := 0;
            v_admin_fee_amount := 0;
            v_payout_amount := v_base_price;
        ELSE
            -- Use stored admin_fee or fall back to talent's current percentage
            IF v_order.admin_fee IS NOT NULL AND v_order.admin_fee > 0 AND v_order.admin_fee <= 100 THEN
                v_admin_fee_pct := v_order.admin_fee;
            ELSE
                v_admin_fee_pct := COALESCE(v_talent_profile.admin_fee_percentage, 25);
            END IF;
            
            v_admin_fee_amount := v_base_price * (v_admin_fee_pct / 100.0);
            v_payout_amount := v_base_price - v_admin_fee_amount;
        END IF;
        
        -- Update the payout
        IF v_order.payout_id IS NOT NULL THEN
            UPDATE payouts
            SET 
                order_amount = v_base_price,
                admin_fee_percentage = v_admin_fee_pct,
                admin_fee_amount = v_admin_fee_amount,
                payout_amount = v_payout_amount,
                updated_at = NOW()
            WHERE id = v_order.payout_id;
            
            RAISE NOTICE 'Fixed payout for order %: base=$ %, fee=$ % (%%%), payout=$ %',
                v_order.id, v_base_price, v_admin_fee_amount, v_admin_fee_pct, v_payout_amount;
        END IF;
    END LOOP;
END $$;

-- Recalculate batch totals for Nick's batch
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
    updated_at = NOW()
WHERE talent_id = (SELECT talent_id FROM orders WHERE id = 'faced80c-da3d-4af0-bc01-9e76ac83e52d');

COMMIT;

-- Verify the fix
SELECT 
    'AFTER FIX' as status,
    tp.username,
    o.id,
    o.amount as cents,
    (o.amount / 100.0) as gross_dollars,
    (o.amount / 100.0 / 1.029)::numeric(10,2) as base_price,
    p.order_amount as payout_order_amount,
    p.payout_amount as payout_amount
FROM orders o
LEFT JOIN talent_profiles tp ON tp.id = o.talent_id
LEFT JOIN payouts p ON p.order_id = o.id
WHERE o.id = 'faced80c-da3d-4af0-bc01-9e76ac83e52d';


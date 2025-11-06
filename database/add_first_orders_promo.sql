-- Add promotional tracking for first 10 orders with 0% admin fee
-- After 10 orders, talent reverts to their configured admin_fee_percentage

-- Step 1: Add column to track if talent is in promotional period
ALTER TABLE talent_profiles 
ADD COLUMN IF NOT EXISTS first_orders_promo_active BOOLEAN DEFAULT true;

-- Step 2: Add column to track completed orders count for promo
-- (we already have fulfilled_orders, but let's add a specific counter for clarity)
-- This will help us track progress toward the 10-order threshold

-- Step 3: Create a function to calculate admin fee based on promo status
CREATE OR REPLACE FUNCTION calculate_admin_fee_for_talent(
    p_talent_id UUID
) RETURNS NUMERIC AS $$
DECLARE
    v_fulfilled_count INTEGER;
    v_promo_active BOOLEAN;
    v_admin_fee_percentage NUMERIC;
BEGIN
    -- Get talent's fulfilled orders count and promo status
    SELECT 
        fulfilled_orders,
        first_orders_promo_active,
        COALESCE(admin_fee_percentage, 25) -- Default to 25% if not set
    INTO 
        v_fulfilled_count,
        v_promo_active,
        v_admin_fee_percentage
    FROM talent_profiles
    WHERE id = p_talent_id;
    
    -- If promo is active and less than 10 fulfilled orders, return 0%
    IF v_promo_active = true AND v_fulfilled_count < 10 THEN
        RETURN 0;
    ELSE
        -- After 10 orders or if promo disabled, return their configured rate
        RETURN v_admin_fee_percentage;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create a function to update promo status after order fulfillment
CREATE OR REPLACE FUNCTION check_and_update_promo_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Only run when order status changes to 'completed'
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        -- Get the talent's current fulfilled_orders count
        UPDATE talent_profiles
        SET first_orders_promo_active = CASE 
            WHEN fulfilled_orders >= 10 THEN false
            ELSE first_orders_promo_active
        END
        WHERE id = NEW.talent_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create trigger to automatically update promo status
DROP TRIGGER IF EXISTS trigger_update_promo_status ON orders;
CREATE TRIGGER trigger_update_promo_status
    AFTER UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION check_and_update_promo_status();

-- Step 6: Activate promo for all existing talent (optional - comment out if you don't want this)
UPDATE talent_profiles 
SET first_orders_promo_active = true
WHERE fulfilled_orders < 10;

-- Step 7: For talent who already completed 10+ orders, disable promo
UPDATE talent_profiles 
SET first_orders_promo_active = false
WHERE fulfilled_orders >= 10;

-- Verification queries (uncomment to test)
-- SELECT id, temp_full_name, fulfilled_orders, first_orders_promo_active, admin_fee_percentage, 
--        calculate_admin_fee_for_talent(id) as current_admin_fee
-- FROM talent_profiles
-- ORDER BY fulfilled_orders DESC;


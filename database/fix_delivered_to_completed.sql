-- Fix the trigger function to use 'completed' instead of 'delivered'
-- This is causing the "invalid input value for enum order_status: delivered" error

CREATE OR REPLACE FUNCTION check_and_update_promo_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Only run when order status changes to 'completed' (not 'delivered')
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

-- Verify the function was updated
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'check_and_update_promo_status';


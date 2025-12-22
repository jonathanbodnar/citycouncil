-- Fix fulfilled_orders counter for ALL talent profiles
-- This ensures the 0% fee promo (X/10 orders) displays correctly

-- Step 1: Check current state - what's the discrepancy?
SELECT 
    tp.id,
    tp.username,
    tp.temp_full_name,
    tp.fulfilled_orders as current_count,
    (
        SELECT COUNT(*)
        FROM orders o
        WHERE o.talent_id = tp.id
        AND o.status = 'completed'
        AND o.video_url IS NOT NULL
        AND o.video_url != ''
    ) as actual_completed_with_video,
    (
        SELECT COUNT(*)
        FROM orders o
        WHERE o.talent_id = tp.id
        AND o.status = 'completed'
    ) as all_completed_orders,
    tp.first_orders_promo_active,
    CASE 
        WHEN tp.first_orders_promo_active AND tp.fulfilled_orders < 10 THEN 'Should show 0% fee'
        ELSE 'Normal fees'
    END as fee_status
FROM talent_profiles tp
WHERE tp.is_active = true
ORDER BY tp.temp_full_name;

-- Step 2: Backfill fulfilled_orders to match ACTUAL completed orders with videos
UPDATE talent_profiles tp
SET fulfilled_orders = (
    SELECT COUNT(*)
    FROM orders o
    WHERE o.talent_id = tp.id
    AND o.status = 'completed'
    AND o.video_url IS NOT NULL
    AND o.video_url != ''
);

-- Step 3: Update first_orders_promo_active based on the new count
-- If they have 10+ orders, disable the promo
UPDATE talent_profiles
SET first_orders_promo_active = false
WHERE fulfilled_orders >= 10
AND first_orders_promo_active = true;

-- Step 4: Make sure talent with < 10 orders have promo active
UPDATE talent_profiles
SET first_orders_promo_active = true
WHERE fulfilled_orders < 10
AND (first_orders_promo_active = false OR first_orders_promo_active IS NULL);

-- Step 5: Verify the fix
SELECT 
    tp.username,
    tp.temp_full_name,
    tp.fulfilled_orders as updated_count,
    tp.first_orders_promo_active,
    CASE 
        WHEN tp.first_orders_promo_active AND tp.fulfilled_orders < 10 THEN CONCAT('0% FEE (', tp.fulfilled_orders, '/10)')
        ELSE 'Normal fees'
    END as display_status
FROM talent_profiles tp
WHERE tp.is_active = true
ORDER BY tp.fulfilled_orders DESC;

-- Step 6: Ensure the trigger exists to auto-increment going forward
CREATE OR REPLACE FUNCTION increment_fulfilled_orders()
RETURNS TRIGGER AS $$
BEGIN
    -- Only increment when:
    -- 1. Order status changes to 'completed'
    -- 2. Video URL is set (not null and not empty)
    -- 3. This is a new completion (old status wasn't 'completed' or old video_url was empty)
    IF NEW.status = 'completed' 
       AND NEW.video_url IS NOT NULL 
       AND NEW.video_url != '' 
       AND (OLD.status != 'completed' OR OLD.video_url IS NULL OR OLD.video_url = '') THEN
        
        UPDATE talent_profiles
        SET fulfilled_orders = fulfilled_orders + 1,
            -- Auto-disable promo if they hit 10 orders
            first_orders_promo_active = CASE 
                WHEN fulfilled_orders + 1 >= 10 THEN false 
                ELSE first_orders_promo_active 
            END
        WHERE id = NEW.talent_id;
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate trigger
DROP TRIGGER IF EXISTS trigger_increment_fulfilled_orders ON orders;

CREATE TRIGGER trigger_increment_fulfilled_orders
    AFTER UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION increment_fulfilled_orders();



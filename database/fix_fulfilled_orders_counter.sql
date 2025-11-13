-- Fix fulfilled_orders counter for talent profiles
-- This should increment when an order is completed with a video

-- First, update Shawn's count manually based on actual completed orders
UPDATE talent_profiles tp
SET fulfilled_orders = (
    SELECT COUNT(*)
    FROM orders o
    WHERE o.talent_id = tp.id
    AND o.status = 'completed'
    AND o.video_url IS NOT NULL
    AND o.video_url != ''
)
WHERE tp.username = 'shawnfarash';

-- Now create/replace trigger to auto-increment fulfilled_orders
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
        SET fulfilled_orders = fulfilled_orders + 1
        WHERE id = NEW.talent_id;
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_increment_fulfilled_orders ON orders;

-- Create trigger
CREATE TRIGGER trigger_increment_fulfilled_orders
    AFTER UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION increment_fulfilled_orders();

-- Backfill all talent fulfilled_orders counts
UPDATE talent_profiles tp
SET fulfilled_orders = (
    SELECT COUNT(*)
    FROM orders o
    WHERE o.talent_id = tp.id
    AND o.status = 'completed'
    AND o.video_url IS NOT NULL
    AND o.video_url != ''
);

-- Verify Shawn's count
SELECT 
    tp.username,
    tp.temp_full_name,
    tp.fulfilled_orders as counter,
    (
        SELECT COUNT(*)
        FROM orders o
        WHERE o.talent_id = tp.id
        AND o.status = 'completed'
        AND o.video_url IS NOT NULL
        AND o.video_url != ''
    ) as actual_completed_orders,
    tp.first_orders_promo_active,
    tp.admin_fee_percentage
FROM talent_profiles tp
WHERE tp.username = 'shawnfarash';


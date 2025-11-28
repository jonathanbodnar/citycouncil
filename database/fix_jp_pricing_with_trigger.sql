-- Fix JP Sears pricing issue with the trigger

-- First, drop the NOT NULL constraint temporarily
ALTER TABLE talent_profiles ALTER COLUMN pricing DROP NOT NULL;
ALTER TABLE talent_profiles ALTER COLUMN corporate_pricing DROP NOT NULL;

-- Update JP Sears with all pricing fields
UPDATE talent_profiles
SET 
    pricing = 150.00,
    corporate_pricing = 225.00,
    base_pricing = 150.00,  -- This is important for the pricing tier trigger!
    current_pricing_tier = 1,
    current_month_orders = 0,
    last_order_reset_date = CURRENT_DATE,
    updated_at = NOW()
WHERE username = 'jpsears';

-- Verify JP now has all pricing fields
SELECT 
    username, 
    pricing, 
    corporate_pricing, 
    base_pricing,
    current_pricing_tier,
    current_month_orders,
    last_order_reset_date
FROM talent_profiles 
WHERE username = 'jpsears';

-- Now add the constraints back
ALTER TABLE talent_profiles ALTER COLUMN pricing SET DEFAULT 150.00;
ALTER TABLE talent_profiles ALTER COLUMN pricing SET NOT NULL;
ALTER TABLE talent_profiles ALTER COLUMN corporate_pricing SET DEFAULT 225.00;
ALTER TABLE talent_profiles ALTER COLUMN corporate_pricing SET NOT NULL;


-- Add 24hr Express Delivery Feature
-- This adds the ability for talent to offer rush/express 24hr delivery at a 20% premium

-- Add columns to talent_profiles
ALTER TABLE talent_profiles 
ADD COLUMN IF NOT EXISTS express_delivery_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS express_delivery_price NUMERIC(10,2);

-- Add column to orders to track if it's an express delivery order
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS is_express_delivery BOOLEAN DEFAULT false;

-- Update express_delivery_price for all talent to be 20% more than base price
UPDATE talent_profiles 
SET express_delivery_price = ROUND(pricing * 1.2, 2)
WHERE express_delivery_price IS NULL AND pricing IS NOT NULL;

-- Create index for express delivery orders
CREATE INDEX IF NOT EXISTS idx_orders_express_delivery ON orders(is_express_delivery) WHERE is_express_delivery = true;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

-- Verify the changes
SELECT 
  'talent_profiles columns' as check_type,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'talent_profiles' 
  AND column_name IN ('express_delivery_enabled', 'express_delivery_price');

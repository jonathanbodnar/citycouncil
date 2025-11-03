-- Add support for historical order uploads
-- This allows admins to bulk upload old videos and map them to talent profiles

-- Add is_historical column to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS is_historical BOOLEAN DEFAULT FALSE;

-- Add comment for documentation
COMMENT ON COLUMN orders.is_historical IS 'Marks orders that were uploaded as historical data (not real customer orders)';

-- Create index for filtering
CREATE INDEX IF NOT EXISTS idx_orders_is_historical 
ON orders(is_historical) 
WHERE is_historical = false;

-- Create or replace the increment_talent_orders function
-- This function updates talent statistics when orders are created/completed
CREATE OR REPLACE FUNCTION increment_talent_orders(
  talent_profile_id UUID,
  is_fulfilled BOOLEAN DEFAULT FALSE
)
RETURNS VOID AS $$
BEGIN
  IF is_fulfilled THEN
    UPDATE talent_profiles
    SET 
      total_orders = total_orders + 1,
      fulfilled_orders = fulfilled_orders + 1
    WHERE id = talent_profile_id;
  ELSE
    UPDATE talent_profiles
    SET total_orders = total_orders + 1
    WHERE id = talent_profile_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION increment_talent_orders TO authenticated;

-- Success message
SELECT 'Historical orders feature enabled!' as status;


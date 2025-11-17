-- =====================================================
-- PRICING URGENCY SYSTEM
-- =====================================================
-- Creates a dynamic pricing system that increases prices
-- after every 10 orders per month, creating urgency.
--
-- Pricing Tiers:
-- - Tier 1 (0-10 orders): Base price
-- - Tier 2 (11-20 orders): Base price + 5%
-- - Tier 3 (21-30 orders): Base price + 10%
-- - Tier 4 (31+ orders): Back to base price (cycle repeats)
-- =====================================================

-- Add columns to talent_profiles for pricing tracking
ALTER TABLE talent_profiles
ADD COLUMN IF NOT EXISTS current_month_orders INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_order_reset_date DATE DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS base_pricing DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS current_pricing_tier INT DEFAULT 1;

-- Migrate existing pricing to base_pricing if not set
UPDATE talent_profiles
SET base_pricing = pricing
WHERE base_pricing IS NULL;

-- Create function to get current price multiplier based on tier
CREATE OR REPLACE FUNCTION get_price_multiplier(tier INT)
RETURNS DECIMAL(3,2) AS $$
BEGIN
  CASE tier
    WHEN 1 THEN RETURN 1.00;   -- Base price (0-10 orders)
    WHEN 2 THEN RETURN 1.05;   -- +5% (11-20 orders)
    WHEN 3 THEN RETURN 1.10;   -- +10% (21-30 orders)
    ELSE RETURN 1.00;          -- Back to base (31+ orders)
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create function to calculate current tier based on monthly orders
CREATE OR REPLACE FUNCTION calculate_pricing_tier(monthly_orders INT)
RETURNS INT AS $$
BEGIN
  IF monthly_orders < 10 THEN
    RETURN 1;  -- Tier 1: 0-9 orders
  ELSIF monthly_orders < 20 THEN
    RETURN 2;  -- Tier 2: 10-19 orders
  ELSIF monthly_orders < 30 THEN
    RETURN 3;  -- Tier 3: 20-29 orders
  ELSE
    RETURN 1;  -- Tier 4: 30+ orders (back to base)
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create function to get orders remaining at current price
CREATE OR REPLACE FUNCTION get_orders_remaining_at_price(monthly_orders INT)
RETURNS INT AS $$
BEGIN
  -- Calculate orders remaining in current tier of 10
  RETURN 10 - (monthly_orders % 10);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create function to update talent pricing after new order
CREATE OR REPLACE FUNCTION update_talent_pricing_on_order()
RETURNS TRIGGER AS $$
DECLARE
  talent_record RECORD;
  new_month_start DATE;
BEGIN
  -- Only process completed orders
  IF NEW.status != 'completed' THEN
    RETURN NEW;
  END IF;

  -- Get talent profile
  SELECT * INTO talent_record
  FROM talent_profiles
  WHERE id = NEW.talent_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Check if we need to reset monthly counter (new month)
  new_month_start := DATE_TRUNC('month', CURRENT_DATE)::DATE;
  
  IF talent_record.last_order_reset_date < new_month_start THEN
    -- New month - reset counter
    UPDATE talent_profiles
    SET 
      current_month_orders = 1,
      last_order_reset_date = CURRENT_DATE,
      current_pricing_tier = 1,
      pricing = base_pricing
    WHERE id = NEW.talent_id;
  ELSE
    -- Same month - increment counter and update pricing
    UPDATE talent_profiles
    SET 
      current_month_orders = talent_record.current_month_orders + 1,
      current_pricing_tier = calculate_pricing_tier(talent_record.current_month_orders + 1),
      pricing = base_pricing * get_price_multiplier(calculate_pricing_tier(talent_record.current_month_orders + 1)),
      last_order_reset_date = CURRENT_DATE
    WHERE id = NEW.talent_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to update pricing when order is completed
DROP TRIGGER IF EXISTS trigger_update_pricing_on_order ON orders;
CREATE TRIGGER trigger_update_pricing_on_order
  AFTER INSERT OR UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_talent_pricing_on_order();

-- Create view for talent pricing info (for frontend)
CREATE OR REPLACE VIEW talent_pricing_urgency AS
SELECT 
  tp.id,
  tp.user_id,
  tp.username,
  tp.base_pricing,
  tp.pricing as current_pricing,
  tp.current_month_orders,
  tp.current_pricing_tier,
  get_orders_remaining_at_price(tp.current_month_orders) as orders_remaining_at_price,
  get_price_multiplier(tp.current_pricing_tier) as current_multiplier,
  CASE 
    WHEN tp.current_pricing_tier = 1 THEN ROUND(tp.base_pricing * 1.05, 2)
    WHEN tp.current_pricing_tier = 2 THEN ROUND(tp.base_pricing * 1.10, 2)
    WHEN tp.current_pricing_tier = 3 THEN tp.base_pricing
    ELSE ROUND(tp.base_pricing * 1.05, 2)
  END as next_tier_price,
  CASE 
    WHEN tp.current_pricing_tier = 1 THEN 'Base Price'
    WHEN tp.current_pricing_tier = 2 THEN '+5% Premium'
    WHEN tp.current_pricing_tier = 3 THEN '+10% Premium'
    ELSE 'Base Price'
  END as tier_description
FROM talent_profiles tp;

-- Grant access to view
GRANT SELECT ON talent_pricing_urgency TO authenticated;
GRANT SELECT ON talent_pricing_urgency TO anon;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_talent_profiles_pricing_urgency 
ON talent_profiles(id, current_month_orders, current_pricing_tier);

-- =====================================================
-- MANUAL TESTING / VERIFICATION
-- =====================================================

-- View current pricing status for all talents
-- SELECT * FROM talent_pricing_urgency;

-- Manually test tier calculation
-- SELECT 
--   monthly_orders,
--   calculate_pricing_tier(monthly_orders) as tier,
--   get_orders_remaining_at_price(monthly_orders) as remaining,
--   get_price_multiplier(calculate_pricing_tier(monthly_orders)) as multiplier
-- FROM generate_series(0, 35) as monthly_orders;

COMMENT ON COLUMN talent_profiles.current_month_orders IS 'Number of completed orders this month (resets monthly)';
COMMENT ON COLUMN talent_profiles.last_order_reset_date IS 'Date of last order or monthly reset';
COMMENT ON COLUMN talent_profiles.base_pricing IS 'Original base price (never changes)';
COMMENT ON COLUMN talent_profiles.current_pricing_tier IS 'Current pricing tier (1-3, cycles back to 1 after 30)';


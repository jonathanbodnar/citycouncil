-- =====================================================
-- PERMANENT FIX: Prevent NULL pricing issues FOREVER
-- This fixes all current talent AND prevents future issues
-- =====================================================

-- Step 1: Fix ALL existing talent with NULL pricing or base_pricing
-- Use their current pricing if available, otherwise default to $75
UPDATE talent_profiles
SET 
  pricing = COALESCE(pricing, base_pricing, 75),
  base_pricing = COALESCE(base_pricing, pricing, 75),
  corporate_pricing = COALESCE(corporate_pricing, COALESCE(pricing, base_pricing, 75) * 1.5)
WHERE pricing IS NULL OR base_pricing IS NULL OR corporate_pricing IS NULL;

-- Step 2: Show what was fixed
SELECT 
  '✅ FIXED' as status,
  COUNT(*) as talent_fixed
FROM talent_profiles
WHERE pricing IS NOT NULL AND base_pricing IS NOT NULL;

-- Step 3: Drop NOT NULL constraints temporarily (in case they exist and block defaults)
ALTER TABLE talent_profiles ALTER COLUMN pricing DROP NOT NULL;
ALTER TABLE talent_profiles ALTER COLUMN base_pricing DROP NOT NULL;
ALTER TABLE talent_profiles ALTER COLUMN corporate_pricing DROP NOT NULL;

-- Step 4: Set DEFAULT values on all pricing columns
-- These defaults will apply to ANY new row that doesn't specify a value
ALTER TABLE talent_profiles ALTER COLUMN pricing SET DEFAULT 75;
ALTER TABLE talent_profiles ALTER COLUMN base_pricing SET DEFAULT 75;
ALTER TABLE talent_profiles ALTER COLUMN corporate_pricing SET DEFAULT 112.50;

-- Step 5: Ensure NO nulls exist before adding constraints
UPDATE talent_profiles SET pricing = 75 WHERE pricing IS NULL;
UPDATE talent_profiles SET base_pricing = 75 WHERE base_pricing IS NULL;
UPDATE talent_profiles SET corporate_pricing = 112.50 WHERE corporate_pricing IS NULL;

-- Step 6: Re-add NOT NULL constraints
ALTER TABLE talent_profiles ALTER COLUMN pricing SET NOT NULL;
ALTER TABLE talent_profiles ALTER COLUMN base_pricing SET NOT NULL;
ALTER TABLE talent_profiles ALTER COLUMN corporate_pricing SET NOT NULL;

-- Step 7: Fix the pricing urgency trigger to handle edge cases gracefully
CREATE OR REPLACE FUNCTION update_talent_pricing_on_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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

  -- SAFETY: If base_pricing is somehow NULL, use current pricing or default
  IF talent_record.base_pricing IS NULL THEN
    UPDATE talent_profiles
    SET base_pricing = COALESCE(pricing, 75)
    WHERE id = NEW.talent_id;
    
    -- Re-fetch the record
    SELECT * INTO talent_record
    FROM talent_profiles
    WHERE id = NEW.talent_id;
  END IF;

  -- Check if we need to reset monthly counter (new month)
  new_month_start := DATE_TRUNC('month', CURRENT_DATE)::DATE;
  
  IF talent_record.last_order_reset_date IS NULL OR talent_record.last_order_reset_date < new_month_start THEN
    -- New month - reset counter
    UPDATE talent_profiles
    SET 
      current_month_orders = 1,
      last_order_reset_date = CURRENT_DATE,
      current_pricing_tier = 1,
      pricing = COALESCE(base_pricing, pricing, 75)
    WHERE id = NEW.talent_id;
  ELSE
    -- Same month - increment counter and update pricing
    UPDATE talent_profiles
    SET 
      current_month_orders = COALESCE(talent_record.current_month_orders, 0) + 1,
      current_pricing_tier = calculate_pricing_tier(COALESCE(talent_record.current_month_orders, 0) + 1),
      pricing = COALESCE(base_pricing, pricing, 75) * get_price_multiplier(calculate_pricing_tier(COALESCE(talent_record.current_month_orders, 0) + 1)),
      last_order_reset_date = CURRENT_DATE
    WHERE id = NEW.talent_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Step 8: Also fix the increment_fulfilled_orders trigger to be safe
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
        
        -- Use a safe update that won't fail on NULL pricing
        UPDATE talent_profiles
        SET 
          fulfilled_orders = COALESCE(fulfilled_orders, 0) + 1,
          -- Auto-disable promo if they hit 10 orders
          first_orders_promo_active = CASE 
              WHEN COALESCE(fulfilled_orders, 0) + 1 >= 10 THEN false 
              ELSE first_orders_promo_active 
          END,
          -- Ensure pricing columns are never NULL (safety net)
          pricing = COALESCE(pricing, base_pricing, 75),
          base_pricing = COALESCE(base_pricing, pricing, 75)
        WHERE id = NEW.talent_id;
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 9: Verify the fix
SELECT 
  'VERIFICATION' as check_type,
  COUNT(*) FILTER (WHERE pricing IS NULL) as null_pricing,
  COUNT(*) FILTER (WHERE base_pricing IS NULL) as null_base_pricing,
  COUNT(*) FILTER (WHERE corporate_pricing IS NULL) as null_corporate_pricing,
  COUNT(*) as total_talent
FROM talent_profiles;

-- Step 10: List any talent that might still have issues
SELECT 
  id, 
  username, 
  temp_full_name,
  pricing,
  base_pricing,
  corporate_pricing,
  is_active
FROM talent_profiles
WHERE pricing IS NULL OR base_pricing IS NULL OR corporate_pricing IS NULL;

-- If the above returns 0 rows, we're good!
SELECT '✅ ALL PRICING COLUMNS NOW HAVE DEFAULTS AND NOT NULL CONSTRAINTS' as result;
SELECT '✅ TRIGGERS UPDATED TO HANDLE EDGE CASES SAFELY' as result;
SELECT '✅ THIS ISSUE SHOULD NEVER HAPPEN AGAIN' as result;


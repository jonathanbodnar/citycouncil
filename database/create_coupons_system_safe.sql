-- Create coupon system for ShoutOut (SAFE VERSION - handles existing objects)
-- Allows admin to create coupons with percentage or dollar amount discounts

-- 1. Create coupons table (IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value DECIMAL(10, 2) NOT NULL CHECK (discount_value > 0),
  max_discount_amount DECIMAL(10, 2), -- Max discount for percentage coupons (optional)
  min_order_amount DECIMAL(10, 2), -- Minimum order amount required (optional)
  max_uses INTEGER, -- Max total uses (null = unlimited)
  max_uses_per_user INTEGER DEFAULT 1, -- Max uses per user
  used_count INTEGER DEFAULT 0 NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  valid_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  valid_until TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Add indexes (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_coupons_code ON public.coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_is_active ON public.coupons(is_active);
CREATE INDEX IF NOT EXISTS idx_coupons_valid_until ON public.coupons(valid_until);

-- 3. Add coupon columns to orders table (IF NOT EXISTS)
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS coupon_id UUID REFERENCES public.coupons(id),
ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(50),
ADD COLUMN IF NOT EXISTS original_amount DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10, 2) DEFAULT 0;

-- 4. Add indexes for orders coupon columns
CREATE INDEX IF NOT EXISTS idx_orders_coupon_id ON public.orders(coupon_id);
CREATE INDEX IF NOT EXISTS idx_orders_coupon_code ON public.orders(coupon_code);

-- 5. Create coupon_usage tracking table (IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS public.coupon_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(coupon_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_coupon_usage_coupon_user ON public.coupon_usage(coupon_id, user_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_user ON public.coupon_usage(user_id);

-- 6. Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_coupon_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_coupons_updated_at ON public.coupons;
CREATE TRIGGER update_coupons_updated_at
  BEFORE UPDATE ON public.coupons
  FOR EACH ROW
  EXECUTE FUNCTION update_coupon_updated_at();

-- 7. Enable RLS on coupons table
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Users can read active coupons" ON public.coupons;
DROP POLICY IF EXISTS "Admins have full access to coupons" ON public.coupons;

-- Allow authenticated users to read active coupons
CREATE POLICY "Users can read active coupons"
  ON public.coupons
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Allow admins full access
CREATE POLICY "Admins have full access to coupons"
  ON public.coupons
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND users.user_type = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND users.user_type = 'admin'
    )
  );

-- 8. Enable RLS on coupon_usage
ALTER TABLE public.coupon_usage ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first
DROP POLICY IF EXISTS "Users can read own coupon usage" ON public.coupon_usage;
DROP POLICY IF EXISTS "Service role full access to coupon usage" ON public.coupon_usage;

-- Users can read their own usage
CREATE POLICY "Users can read own coupon usage"
  ON public.coupon_usage
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Service role can manage all
CREATE POLICY "Service role full access to coupon usage"
  ON public.coupon_usage
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 9. Insert some example coupons (optional - for testing)
INSERT INTO public.coupons (code, description, discount_type, discount_value, max_uses, is_active) VALUES
('WELCOME10', 'Welcome discount - 10% off first order', 'percentage', 10, NULL, true),
('SAVE20', 'Save $20 on any order', 'fixed', 20, 100, true),
('VIP25', '25% off for VIP customers', 'percentage', 25, 50, true)
ON CONFLICT (code) DO NOTHING;

-- 10. Create function to validate and apply coupon
CREATE OR REPLACE FUNCTION validate_and_apply_coupon(
  p_coupon_code VARCHAR(50),
  p_user_id UUID,
  p_order_amount DECIMAL(10, 2)
)
RETURNS TABLE (
  valid BOOLEAN,
  discount_amount DECIMAL(10, 2),
  final_amount DECIMAL(10, 2),
  coupon_id UUID,
  message TEXT
) AS $$
DECLARE
  v_coupon RECORD;
  v_usage_count INTEGER;
  v_discount DECIMAL(10, 2);
  v_final DECIMAL(10, 2);
BEGIN
  -- Find coupon
  SELECT * INTO v_coupon
  FROM public.coupons
  WHERE UPPER(code) = UPPER(p_coupon_code)
    AND is_active = true
    AND (valid_from IS NULL OR valid_from <= NOW())
    AND (valid_until IS NULL OR valid_until >= NOW());

  -- Coupon not found or inactive
  IF v_coupon.id IS NULL THEN
    RETURN QUERY SELECT false, 0::DECIMAL, p_order_amount, NULL::UUID, 'Invalid or expired coupon code'::TEXT;
    RETURN;
  END IF;

  -- Check minimum order amount
  IF v_coupon.min_order_amount IS NOT NULL AND p_order_amount < v_coupon.min_order_amount THEN
    RETURN QUERY SELECT false, 0::DECIMAL, p_order_amount, NULL::UUID, 
      'Order minimum of $' || v_coupon.min_order_amount || ' required'::TEXT;
    RETURN;
  END IF;

  -- Check max uses
  IF v_coupon.max_uses IS NOT NULL AND v_coupon.used_count >= v_coupon.max_uses THEN
    RETURN QUERY SELECT false, 0::DECIMAL, p_order_amount, NULL::UUID, 'Coupon usage limit reached'::TEXT;
    RETURN;
  END IF;

  -- Check per-user usage limit
  SELECT COUNT(*) INTO v_usage_count
  FROM public.coupon_usage
  WHERE coupon_id = v_coupon.id AND user_id = p_user_id;

  IF v_usage_count >= v_coupon.max_uses_per_user THEN
    RETURN QUERY SELECT false, 0::DECIMAL, p_order_amount, NULL::UUID, 
      'You have already used this coupon'::TEXT;
    RETURN;
  END IF;

  -- Calculate discount
  IF v_coupon.discount_type = 'percentage' THEN
    v_discount := (p_order_amount * v_coupon.discount_value / 100);
    -- Apply max discount cap if set
    IF v_coupon.max_discount_amount IS NOT NULL AND v_discount > v_coupon.max_discount_amount THEN
      v_discount := v_coupon.max_discount_amount;
    END IF;
  ELSE
    v_discount := v_coupon.discount_value;
  END IF;

  -- Ensure discount doesn't exceed order amount
  IF v_discount > p_order_amount THEN
    v_discount := p_order_amount;
  END IF;

  v_final := p_order_amount - v_discount;

  -- Return valid coupon with calculated amounts
  RETURN QUERY SELECT true, v_discount, v_final, v_coupon.id, 'Coupon applied successfully!'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Verify everything
SELECT '✅ Coupon system created successfully!' AS status;
SELECT 'Tables: coupons, coupon_usage' AS tables;
SELECT 'Columns added to orders: coupon_id, coupon_code, original_amount, discount_amount' AS orders_columns;
SELECT 'Test coupons: WELCOME10, SAVE20, VIP25' AS test_coupons;


-- Create comprehensive payouts system for talent
-- Handles individual payouts, weekly batching, refunds, and earnings tracking

-- 1. Create payouts table for individual payout records
CREATE TABLE IF NOT EXISTS public.payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_id UUID NOT NULL REFERENCES public.talent_profiles(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  
  -- Amount calculations
  order_amount DECIMAL(10,2) NOT NULL, -- Original order amount
  admin_fee_percentage DECIMAL(5,2) NOT NULL, -- Admin fee % at time of order
  admin_fee_amount DECIMAL(10,2) NOT NULL, -- Calculated admin fee
  payout_amount DECIMAL(10,2) NOT NULL, -- Amount talent receives (order_amount - admin_fee_amount)
  
  -- Status and batching
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, batched, processing, paid, failed
  week_start_date DATE NOT NULL, -- Monday of the week this payout belongs to
  week_end_date DATE NOT NULL, -- Sunday of the week this payout belongs to
  batch_id UUID, -- Links to payout_batches table when batched
  
  -- Refund handling
  is_refunded BOOLEAN DEFAULT false,
  refunded_at TIMESTAMP WITH TIME ZONE,
  refund_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT payouts_order_unique UNIQUE(order_id)
);

-- 2. Create payout_batches table for weekly groupings
CREATE TABLE IF NOT EXISTS public.payout_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_id UUID NOT NULL REFERENCES public.talent_profiles(id) ON DELETE CASCADE,
  
  -- Week information
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  
  -- Batch totals
  total_orders INTEGER NOT NULL DEFAULT 0,
  total_payout_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_refunded_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  net_payout_amount DECIMAL(10,2) NOT NULL DEFAULT 0, -- total_payout - total_refunded
  
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, processing, paid, failed
  
  -- Moov integration
  moov_transfer_id VARCHAR(255),
  moov_transfer_status VARCHAR(100),
  processed_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT payout_batches_talent_week_unique UNIQUE(talent_id, week_start_date)
);

-- 3. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_payouts_talent_id ON public.payouts(talent_id);
CREATE INDEX IF NOT EXISTS idx_payouts_order_id ON public.payouts(order_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON public.payouts(status);
CREATE INDEX IF NOT EXISTS idx_payouts_week_start ON public.payouts(week_start_date);
CREATE INDEX IF NOT EXISTS idx_payouts_batch_id ON public.payouts(batch_id);
CREATE INDEX IF NOT EXISTS idx_payouts_is_refunded ON public.payouts(is_refunded);

CREATE INDEX IF NOT EXISTS idx_payout_batches_talent_id ON public.payout_batches(talent_id);
CREATE INDEX IF NOT EXISTS idx_payout_batches_status ON public.payout_batches(status);
CREATE INDEX IF NOT EXISTS idx_payout_batches_week_start ON public.payout_batches(week_start_date);

-- 4. Add total_earnings to talent_profiles if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'talent_profiles' 
    AND column_name = 'total_earnings'
  ) THEN
    ALTER TABLE public.talent_profiles 
    ADD COLUMN total_earnings DECIMAL(10,2) DEFAULT 0;
  END IF;
END $$;

-- 5. Function to get week start (Monday) and end (Sunday) dates
CREATE OR REPLACE FUNCTION get_week_dates(input_date DATE)
RETURNS TABLE(week_start DATE, week_end DATE) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (input_date - EXTRACT(DOW FROM input_date)::INTEGER + 1)::DATE AS week_start,
    (input_date - EXTRACT(DOW FROM input_date)::INTEGER + 7)::DATE AS week_end;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 6. Function to create payout when order is completed
CREATE OR REPLACE FUNCTION create_payout_on_order_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_week_start DATE;
  v_week_end DATE;
  v_admin_fee_amount DECIMAL(10,2);
  v_payout_amount DECIMAL(10,2);
  v_admin_fee_pct DECIMAL(5,2);
BEGIN
  -- Only process when order status changes to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    
    -- Get talent's admin fee percentage
    SELECT admin_fee_percentage INTO v_admin_fee_pct
    FROM talent_profiles
    WHERE id = NEW.talent_id;
    
    -- Default to 25% if not set
    v_admin_fee_pct := COALESCE(v_admin_fee_pct, 25);
    
    -- Calculate amounts
    v_admin_fee_amount := NEW.amount * (v_admin_fee_pct / 100);
    v_payout_amount := NEW.amount - v_admin_fee_amount;
    
    -- Get week dates for this order
    SELECT week_start, week_end INTO v_week_start, v_week_end
    FROM get_week_dates(NEW.updated_at::DATE);
    
    -- Create payout record
    INSERT INTO payouts (
      talent_id,
      order_id,
      order_amount,
      admin_fee_percentage,
      admin_fee_amount,
      payout_amount,
      status,
      week_start_date,
      week_end_date,
      created_at,
      updated_at
    ) VALUES (
      NEW.talent_id,
      NEW.id,
      NEW.amount,
      v_admin_fee_pct,
      v_admin_fee_amount,
      v_payout_amount,
      'pending',
      v_week_start,
      v_week_end,
      NOW(),
      NOW()
    )
    ON CONFLICT (order_id) DO UPDATE SET
      order_amount = EXCLUDED.order_amount,
      payout_amount = EXCLUDED.payout_amount,
      updated_at = NOW();
    
    -- Update talent's total earnings
    UPDATE talent_profiles
    SET 
      total_earnings = COALESCE(total_earnings, 0) + v_payout_amount,
      updated_at = NOW()
    WHERE id = NEW.talent_id;
    
    -- Create or update weekly batch
    INSERT INTO payout_batches (
      talent_id,
      week_start_date,
      week_end_date,
      total_orders,
      total_payout_amount,
      net_payout_amount,
      created_at,
      updated_at
    ) VALUES (
      NEW.talent_id,
      v_week_start,
      v_week_end,
      1,
      v_payout_amount,
      v_payout_amount,
      NOW(),
      NOW()
    )
    ON CONFLICT (talent_id, week_start_date) DO UPDATE SET
      total_orders = payout_batches.total_orders + 1,
      total_payout_amount = payout_batches.total_payout_amount + v_payout_amount,
      net_payout_amount = payout_batches.total_payout_amount + v_payout_amount - payout_batches.total_refunded_amount,
      updated_at = NOW();
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Function to handle refunds and adjust payouts
CREATE OR REPLACE FUNCTION handle_payout_refund()
RETURNS TRIGGER AS $$
DECLARE
  v_payout RECORD;
  v_week_start DATE;
  v_week_end DATE;
BEGIN
  -- Only process when order status changes to 'refunded'
  IF NEW.status = 'refunded' AND (OLD.status IS NULL OR OLD.status != 'refunded') THEN
    
    -- Find the payout for this order
    SELECT * INTO v_payout
    FROM payouts
    WHERE order_id = NEW.id;
    
    IF FOUND THEN
      -- Mark payout as refunded
      UPDATE payouts
      SET 
        is_refunded = true,
        refunded_at = NOW(),
        refund_reason = 'Order refunded',
        updated_at = NOW()
      WHERE order_id = NEW.id;
      
      -- Subtract from talent's total earnings
      UPDATE talent_profiles
      SET 
        total_earnings = GREATEST(COALESCE(total_earnings, 0) - v_payout.payout_amount, 0),
        updated_at = NOW()
      WHERE id = NEW.talent_id;
      
      -- Update the weekly batch to reflect refund
      UPDATE payout_batches
      SET 
        total_refunded_amount = total_refunded_amount + v_payout.payout_amount,
        net_payout_amount = total_payout_amount - (total_refunded_amount + v_payout.payout_amount),
        updated_at = NOW()
      WHERE talent_id = NEW.talent_id 
        AND week_start_date = v_payout.week_start_date;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Create triggers
DROP TRIGGER IF EXISTS on_order_completed_create_payout ON public.orders;
CREATE TRIGGER on_order_completed_create_payout
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION create_payout_on_order_completion();

DROP TRIGGER IF EXISTS on_order_refunded_update_payout ON public.orders;
CREATE TRIGGER on_order_refunded_update_payout
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION handle_payout_refund();

-- 9. RLS Policies
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_batches ENABLE ROW LEVEL SECURITY;

-- Talent can view their own payouts
DROP POLICY IF EXISTS "Talent can view own payouts" ON public.payouts;
CREATE POLICY "Talent can view own payouts" ON public.payouts
  FOR SELECT TO authenticated
  USING (
    talent_id IN (
      SELECT id FROM talent_profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Talent can view own payout batches" ON public.payout_batches;
CREATE POLICY "Talent can view own payout batches" ON public.payout_batches
  FOR SELECT TO authenticated
  USING (
    talent_id IN (
      SELECT id FROM talent_profiles WHERE user_id = auth.uid()
    )
  );

-- Admin full access
DROP POLICY IF EXISTS "Admin full access to payouts" ON public.payouts;
CREATE POLICY "Admin full access to payouts" ON public.payouts
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND user_type = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admin full access to payout batches" ON public.payout_batches;
CREATE POLICY "Admin full access to payout batches" ON public.payout_batches
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND user_type = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

-- Service role full access
DROP POLICY IF EXISTS "Service role full access to payouts" ON public.payouts;
CREATE POLICY "Service role full access to payouts" ON public.payouts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access to payout batches" ON public.payout_batches;
CREATE POLICY "Service role full access to payout batches" ON public.payout_batches
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 10. Helpful view for talent payout dashboard
CREATE OR REPLACE VIEW talent_payout_summary AS
SELECT 
  p.talent_id,
  tp.username as talent_username,
  COALESCE(u.full_name, tp.temp_full_name) as talent_name,
  p.week_start_date,
  p.week_end_date,
  COUNT(DISTINCT p.id) as total_payouts,
  COUNT(DISTINCT CASE WHEN p.is_refunded THEN p.id END) as refunded_count,
  SUM(p.payout_amount) as total_payout_amount,
  SUM(CASE WHEN p.is_refunded THEN p.payout_amount ELSE 0 END) as total_refunded_amount,
  SUM(CASE WHEN NOT p.is_refunded THEN p.payout_amount ELSE 0 END) as net_payout_amount,
  p.status,
  p.batch_id
FROM payouts p
JOIN talent_profiles tp ON tp.id = p.talent_id
LEFT JOIN users u ON u.id = tp.user_id
GROUP BY 
  p.talent_id, 
  tp.username,
  u.full_name,
  tp.temp_full_name,
  p.week_start_date, 
  p.week_end_date,
  p.status,
  p.batch_id;

COMMENT ON TABLE public.payouts IS 'Individual payout records for completed orders';
COMMENT ON TABLE public.payout_batches IS 'Weekly batched payouts for talent, ready for Moov processing';
COMMENT ON VIEW talent_payout_summary IS 'Summary view of talent payouts grouped by week';


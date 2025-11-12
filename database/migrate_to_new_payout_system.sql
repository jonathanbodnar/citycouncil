-- Migrate from old payout system to new weekly batching system
-- This preserves Moov functionality but adds weekly batching

-- Step 1: Drop old tables (WARNING: This will delete existing payout data)
DROP TABLE IF EXISTS public.payouts CASCADE;
DROP TABLE IF EXISTS public.payout_batches CASCADE;
DROP TABLE IF EXISTS public.payout_errors CASCADE;

-- Step 2: Create new payouts table with weekly batching
CREATE TABLE public.payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_id UUID NOT NULL REFERENCES public.talent_profiles(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  
  -- Amount calculations
  order_amount DECIMAL(10,2) NOT NULL, -- Original order amount
  admin_fee_percentage DECIMAL(5,2) NOT NULL, -- Admin fee % at time of order
  admin_fee_amount DECIMAL(10,2) NOT NULL, -- Calculated admin fee
  payout_amount DECIMAL(10,2) NOT NULL, -- Amount talent receives
  
  -- Status and batching
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, batched, processing, paid, failed
  week_start_date DATE NOT NULL, -- Monday of the week
  week_end_date DATE NOT NULL, -- Sunday of the week
  batch_id UUID, -- Links to payout_batches when processed
  
  -- Refund handling
  is_refunded BOOLEAN DEFAULT false,
  refunded_at TIMESTAMP WITH TIME ZONE,
  refund_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT payouts_order_unique UNIQUE(order_id)
);

-- Step 3: Create payout_batches table for weekly Moov transfers
CREATE TABLE public.payout_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_id UUID NOT NULL REFERENCES public.talent_profiles(id) ON DELETE CASCADE,
  
  -- Week information
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  
  -- Batch totals
  total_orders INTEGER NOT NULL DEFAULT 0,
  total_payout_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_refunded_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  net_payout_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, processing, paid, failed
  
  -- Moov integration (for weekly batch transfer)
  moov_transfer_id VARCHAR(255),
  moov_transfer_status VARCHAR(100),
  processed_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT payout_batches_talent_week_unique UNIQUE(talent_id, week_start_date)
);

-- Step 4: Add total_earnings to talent_profiles
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

-- Step 5: Create indexes
CREATE INDEX idx_payouts_talent_id ON public.payouts(talent_id);
CREATE INDEX idx_payouts_order_id ON public.payouts(order_id);
CREATE INDEX idx_payouts_status ON public.payouts(status);
CREATE INDEX idx_payouts_week_start ON public.payouts(week_start_date);
CREATE INDEX idx_payouts_batch_id ON public.payouts(batch_id);
CREATE INDEX idx_payouts_is_refunded ON public.payouts(is_refunded);

CREATE INDEX idx_payout_batches_talent_id ON public.payout_batches(talent_id);
CREATE INDEX idx_payout_batches_status ON public.payout_batches(status);
CREATE INDEX idx_payout_batches_week_start ON public.payout_batches(week_start_date);

-- Step 6: Create trigger function for order completion
CREATE OR REPLACE FUNCTION create_payout_on_order_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_week_start DATE;
  v_week_end DATE;
  v_admin_fee_amount DECIMAL(10,2);
  v_payout_amount DECIMAL(10,2);
  v_admin_fee_pct DECIMAL(5,2);
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    
    SELECT admin_fee_percentage INTO v_admin_fee_pct
    FROM talent_profiles WHERE id = NEW.talent_id;
    
    v_admin_fee_pct := COALESCE(v_admin_fee_pct, 25);
    v_admin_fee_amount := NEW.amount * (v_admin_fee_pct / 100);
    v_payout_amount := NEW.amount - v_admin_fee_amount;
    
    v_week_start := (NEW.updated_at::DATE - EXTRACT(DOW FROM NEW.updated_at)::INTEGER + 1)::DATE;
    v_week_end := (NEW.updated_at::DATE - EXTRACT(DOW FROM NEW.updated_at)::INTEGER + 7)::DATE;
    
    INSERT INTO payouts (
      talent_id, order_id, order_amount, admin_fee_percentage,
      admin_fee_amount, payout_amount, status,
      week_start_date, week_end_date, created_at, updated_at
    ) VALUES (
      NEW.talent_id, NEW.id, NEW.amount, v_admin_fee_pct,
      v_admin_fee_amount, v_payout_amount, 'pending',
      v_week_start, v_week_end, NOW(), NOW()
    )
    ON CONFLICT (order_id) DO UPDATE SET
      order_amount = EXCLUDED.order_amount,
      payout_amount = EXCLUDED.payout_amount,
      updated_at = NOW();
    
    UPDATE talent_profiles
    SET total_earnings = COALESCE(total_earnings, 0) + v_payout_amount, updated_at = NOW()
    WHERE id = NEW.talent_id;
    
    INSERT INTO payout_batches (
      talent_id, week_start_date, week_end_date,
      total_orders, total_payout_amount, net_payout_amount,
      created_at, updated_at
    ) VALUES (
      NEW.talent_id, v_week_start, v_week_end,
      1, v_payout_amount, v_payout_amount, NOW(), NOW()
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

-- Step 7: Create trigger function for refunds
CREATE OR REPLACE FUNCTION handle_payout_refund()
RETURNS TRIGGER AS $$
DECLARE
  v_payout_amount DECIMAL(10,2);
  v_week_start DATE;
BEGIN
  IF NEW.status = 'refunded' AND (OLD.status IS NULL OR OLD.status != 'refunded') THEN
    
    SELECT payout_amount, week_start_date 
    INTO v_payout_amount, v_week_start
    FROM payouts WHERE order_id = NEW.id;
    
    IF FOUND THEN
      UPDATE payouts
      SET is_refunded = true, refunded_at = NOW(),
          refund_reason = 'Order refunded', updated_at = NOW()
      WHERE order_id = NEW.id;
      
      UPDATE talent_profiles
      SET total_earnings = GREATEST(COALESCE(total_earnings, 0) - v_payout_amount, 0), updated_at = NOW()
      WHERE id = NEW.talent_id;
      
      UPDATE payout_batches
      SET total_refunded_amount = total_refunded_amount + v_payout_amount,
          net_payout_amount = total_payout_amount - (total_refunded_amount + v_payout_amount),
          updated_at = NOW()
      WHERE talent_id = NEW.talent_id AND week_start_date = v_week_start;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 8: Create triggers
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

-- Step 9: Enable RLS
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Talent can view own payouts" ON public.payouts;
CREATE POLICY "Talent can view own payouts" ON public.payouts
  FOR SELECT TO authenticated
  USING (talent_id IN (SELECT id FROM talent_profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Talent can view own payout batches" ON public.payout_batches;
CREATE POLICY "Talent can view own payout batches" ON public.payout_batches
  FOR SELECT TO authenticated
  USING (talent_id IN (SELECT id FROM talent_profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Admin full access to payouts" ON public.payouts;
CREATE POLICY "Admin full access to payouts" ON public.payouts
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND user_type = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND user_type = 'admin'));

DROP POLICY IF EXISTS "Admin full access to payout batches" ON public.payout_batches;
CREATE POLICY "Admin full access to payout batches" ON public.payout_batches
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND user_type = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND user_type = 'admin'));

DROP POLICY IF EXISTS "Service role full access to payouts" ON public.payouts;
CREATE POLICY "Service role full access to payouts" ON public.payouts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access to payout batches" ON public.payout_batches;
CREATE POLICY "Service role full access to payout batches" ON public.payout_batches
  FOR ALL TO service_role USING (true) WITH CHECK (true);

SELECT '✅ Migration complete! New payout system with weekly batching is ready.' AS result;
SELECT 'Individual payouts tracked, batched weekly for Moov transfers via payout_batches table.' AS info;


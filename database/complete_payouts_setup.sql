-- Complete Payout System Setup (Tables already created, now add triggers and policies)

-- 1. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_payouts_talent_id ON public.payouts(talent_id);
CREATE INDEX IF NOT EXISTS idx_payouts_order_id ON public.payouts(order_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON public.payouts(status);
CREATE INDEX IF NOT EXISTS idx_payouts_week_start ON public.payouts(week_start_date);
CREATE INDEX IF NOT EXISTS idx_payouts_batch_id ON public.payouts(batch_id);
CREATE INDEX IF NOT EXISTS idx_payouts_is_refunded ON public.payouts(is_refunded);

CREATE INDEX IF NOT EXISTS idx_payout_batches_talent_id ON public.payout_batches(talent_id);
CREATE INDEX IF NOT EXISTS idx_payout_batches_status ON public.payout_batches(status);
CREATE INDEX IF NOT EXISTS idx_payout_batches_week_start ON public.payout_batches(week_start_date);

-- 2. Function to create payout when order is completed
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
    
    -- Calculate week dates for this order (Monday-Sunday)
    v_week_start := (NEW.updated_at::DATE - EXTRACT(DOW FROM NEW.updated_at)::INTEGER + 1)::DATE;
    v_week_end := (NEW.updated_at::DATE - EXTRACT(DOW FROM NEW.updated_at)::INTEGER + 7)::DATE;
    
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

-- 3. Function to handle refunds and adjust payouts
CREATE OR REPLACE FUNCTION handle_payout_refund()
RETURNS TRIGGER AS $$
DECLARE
  v_payout_amount DECIMAL(10,2);
  v_week_start DATE;
BEGIN
  -- Only process when order status changes to 'refunded'
  IF NEW.status = 'refunded' AND (OLD.status IS NULL OR OLD.status != 'refunded') THEN
    
    -- Get payout details for this order
    SELECT payout_amount, week_start_date 
    INTO v_payout_amount, v_week_start
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
        total_earnings = GREATEST(COALESCE(total_earnings, 0) - v_payout_amount, 0),
        updated_at = NOW()
      WHERE id = NEW.talent_id;
      
      -- Update the weekly batch to reflect refund
      UPDATE payout_batches
      SET 
        total_refunded_amount = total_refunded_amount + v_payout_amount,
        net_payout_amount = total_payout_amount - (total_refunded_amount + v_payout_amount),
        updated_at = NOW()
      WHERE talent_id = NEW.talent_id 
        AND week_start_date = v_week_start;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create triggers
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

-- 5. RLS Policies
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

-- 6. Helpful view for talent payout dashboard
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

SELECT '✅ Payout system setup complete!' AS result;
SELECT 'Triggers created: on_order_completed_create_payout, on_order_refunded_update_payout' AS info;
SELECT 'RLS policies enabled for payouts and payout_batches' AS info;


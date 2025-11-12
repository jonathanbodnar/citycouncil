-- Test the payout system step by step to find the issue

-- Step 1: Check if tables exist
SELECT 'Checking tables...' AS step;

-- Step 2: Try to create just the payouts table
CREATE TABLE IF NOT EXISTS public.payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_id UUID NOT NULL REFERENCES public.talent_profiles(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  
  -- Amount calculations
  order_amount DECIMAL(10,2) NOT NULL,
  admin_fee_percentage DECIMAL(5,2) NOT NULL,
  admin_fee_amount DECIMAL(10,2) NOT NULL,
  payout_amount DECIMAL(10,2) NOT NULL,
  
  -- Status and batching
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  batch_id UUID,
  
  -- Refund handling
  is_refunded BOOLEAN DEFAULT false,
  refunded_at TIMESTAMP WITH TIME ZONE,
  refund_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT payouts_order_unique UNIQUE(order_id)
);

SELECT 'Payouts table created' AS result;

-- Step 3: Try to create payout_batches table
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
  net_payout_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  
  -- Moov integration
  moov_transfer_id VARCHAR(255),
  moov_transfer_status VARCHAR(100),
  processed_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT payout_batches_talent_week_unique UNIQUE(talent_id, week_start_date)
);

SELECT 'Payout batches table created' AS result;

-- Step 4: Add total_earnings column
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

SELECT 'Total earnings column added' AS result;

-- Step 5: Test the week calculation
DO $$
DECLARE
  v_week_start DATE;
  v_week_end DATE;
BEGIN
  v_week_start := (NOW()::DATE - EXTRACT(DOW FROM NOW())::INTEGER + 1)::DATE;
  v_week_end := (NOW()::DATE - EXTRACT(DOW FROM NOW())::INTEGER + 7)::DATE;
  
  RAISE NOTICE 'Week calculation works: % to %', v_week_start, v_week_end;
END $$;

SELECT 'Week calculation test passed' AS result;

-- Step 6: Check what we have
SELECT 
  'Tables created successfully!' AS status,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'payouts') AS payouts_exists,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'payout_batches') AS batches_exists;


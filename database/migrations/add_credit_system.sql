-- Credit System Migration
-- Allows admins to grant credits to users
-- 1 credit = $1.00
-- Credits automatically apply to orders, reducing the payment amount

-- Add credits column to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS credits NUMERIC DEFAULT 0 NOT NULL
CHECK (credits >= 0);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_users_credits ON public.users(credits) WHERE credits > 0;

-- Create credit_transactions table to track all credit activity
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL, -- Positive for credits added, negative for credits used
  balance_after NUMERIC NOT NULL, -- User's credit balance after this transaction
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('admin_grant', 'order_payment', 'refund', 'adjustment')),
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  admin_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for credit_transactions
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON public.credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_order_id ON public.credit_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON public.credit_transactions(created_at DESC);

-- Add credits_used column to orders table to track how much credit was applied
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS credits_used BIGINT DEFAULT 0;

COMMENT ON COLUMN public.orders.credits_used IS 'Amount of user credits applied to this order (in cents)';

-- Enable RLS on credit_transactions
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- Users can view their own credit transactions
CREATE POLICY "Users can view own credit transactions"
  ON public.credit_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all credit transactions
CREATE POLICY "Admins can view all credit transactions"
  ON public.credit_transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.user_type = 'admin'
    )
  );

-- Only admins can insert credit transactions (grants)
CREATE POLICY "Admins can insert credit transactions"
  ON public.credit_transactions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.user_type = 'admin'
    )
  );

-- Function to grant credits to a user
CREATE OR REPLACE FUNCTION grant_user_credits(
  target_user_id UUID,
  credit_amount NUMERIC,
  admin_user_id UUID,
  grant_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_balance NUMERIC;
  transaction_record RECORD;
BEGIN
  -- Verify admin permissions
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = admin_user_id AND user_type = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can grant credits';
  END IF;

  -- Verify target user exists
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = target_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Validate amount
  IF credit_amount <= 0 THEN
    RAISE EXCEPTION 'Credit amount must be positive';
  END IF;

  -- Update user's credit balance
  UPDATE public.users
  SET credits = credits + credit_amount
  WHERE id = target_user_id
  RETURNING credits INTO new_balance;

  -- Record the transaction
  INSERT INTO public.credit_transactions (
    user_id,
    amount,
    balance_after,
    transaction_type,
    admin_id,
    notes
  )
  VALUES (
    target_user_id,
    credit_amount,
    new_balance,
    'admin_grant',
    admin_user_id,
    grant_notes
  )
  RETURNING * INTO transaction_record;

  RETURN jsonb_build_object(
    'success', true,
    'new_balance', new_balance,
    'transaction_id', transaction_record.id,
    'message', 'Credits granted successfully'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Function to use credits for an order (called during order creation)
CREATE OR REPLACE FUNCTION use_credits_for_order(
  p_user_id UUID,
  p_order_id UUID,
  p_order_amount_cents BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_credits NUMERIC;
  credits_to_use_dollars NUMERIC;
  credits_to_use_cents BIGINT;
  remaining_payment_cents BIGINT;
  new_balance NUMERIC;
BEGIN
  -- Get user's current credit balance
  SELECT credits INTO user_credits
  FROM public.users
  WHERE id = p_user_id;

  IF user_credits IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Calculate how much credit to use (in dollars)
  credits_to_use_dollars := LEAST(user_credits, p_order_amount_cents / 100.0);
  credits_to_use_cents := ROUND(credits_to_use_dollars * 100);
  remaining_payment_cents := p_order_amount_cents - credits_to_use_cents;

  -- If credits were used, update balance and record transaction
  IF credits_to_use_dollars > 0 THEN
    -- Deduct credits from user balance
    UPDATE public.users
    SET credits = credits - credits_to_use_dollars
    WHERE id = p_user_id
    RETURNING credits INTO new_balance;

    -- Record the transaction
    INSERT INTO public.credit_transactions (
      user_id,
      amount,
      balance_after,
      transaction_type,
      order_id,
      notes
    )
    VALUES (
      p_user_id,
      -credits_to_use_dollars,
      new_balance,
      'order_payment',
      p_order_id,
      'Credits applied to order'
    );

    -- Update order with credits used
    UPDATE public.orders
    SET credits_used = credits_to_use_cents
    WHERE id = p_order_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'credits_used_cents', credits_to_use_cents,
    'remaining_payment_cents', remaining_payment_cents,
    'new_credit_balance', COALESCE(new_balance, user_credits)
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION grant_user_credits TO authenticated;
GRANT EXECUTE ON FUNCTION use_credits_for_order TO authenticated;

-- Add comment
COMMENT ON TABLE public.credit_transactions IS 'Tracks all credit additions, usage, and adjustments for users';
COMMENT ON COLUMN public.users.credits IS 'User credit balance in dollars (1 credit = $1.00)';


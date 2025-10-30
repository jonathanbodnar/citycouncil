-- Rename orders.stripe_payment_intent_id -> payment_transaction_id
-- And add JSONB column payment_transaction_payload to store Commerce JS response

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'stripe_payment_intent_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'payment_transaction_id'
  ) THEN
    EXECUTE 'ALTER TABLE orders RENAME COLUMN stripe_payment_intent_id TO payment_transaction_id';
  END IF;
END $$;

ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS payment_transaction_payload JSONB;

-- Optional index for faster lookups by transaction id
CREATE INDEX IF NOT EXISTS idx_orders_payment_transaction_id 
  ON orders(payment_transaction_id);

COMMENT ON COLUMN orders.payment_transaction_id IS 'Fortis transaction id (was stripe_payment_intent_id)';
COMMENT ON COLUMN orders.payment_transaction_payload IS 'Raw Commerce JS/Fortis transaction payload stored as JSONB';



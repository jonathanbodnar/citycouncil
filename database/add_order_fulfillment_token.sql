-- Add unique fulfillment token to orders for direct access links
-- Each order gets a unique token that talent can use to access it directly

-- Add fulfillment_token column
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS fulfillment_token VARCHAR(64) UNIQUE;

-- Add index for fast lookup
CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_token 
ON orders(fulfillment_token);

-- Add comment
COMMENT ON COLUMN orders.fulfillment_token IS 
'Unique token for direct order fulfillment link. Allows talent to access order directly via URL.';

-- Generate tokens for existing orders that don't have one
UPDATE orders 
SET fulfillment_token = encode(gen_random_bytes(32), 'hex')
WHERE fulfillment_token IS NULL;

-- Create function to auto-generate token on new orders
CREATE OR REPLACE FUNCTION generate_order_fulfillment_token()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.fulfillment_token IS NULL THEN
    NEW.fulfillment_token := encode(gen_random_bytes(32), 'hex');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate token
DROP TRIGGER IF EXISTS trigger_generate_order_fulfillment_token ON orders;
CREATE TRIGGER trigger_generate_order_fulfillment_token
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION generate_order_fulfillment_token();

-- Example fulfillment link:
-- https://shoutout.us/fulfill/abc123def456...


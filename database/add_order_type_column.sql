-- Add order_type column to orders table for demo orders

-- Add the order_type column
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS order_type VARCHAR(20) DEFAULT 'standard';

-- Add a check constraint to ensure valid order types
ALTER TABLE orders 
ADD CONSTRAINT valid_order_type 
CHECK (order_type IN ('standard', 'demo', 'corporate'));

-- Update existing orders to have 'standard' type
UPDATE orders 
SET order_type = 'standard' 
WHERE order_type IS NULL;

-- Add index for efficient filtering by order type
CREATE INDEX IF NOT EXISTS idx_orders_order_type ON orders(order_type);

-- Verification
SELECT 
  'order_type column added successfully' AS status,
  COUNT(*) AS total_orders,
  COUNT(*) FILTER (WHERE order_type = 'standard') AS standard_orders,
  COUNT(*) FILTER (WHERE order_type = 'demo') AS demo_orders,
  COUNT(*) FILTER (WHERE order_type = 'corporate') AS corporate_orders
FROM orders;


-- Add details_submitted column to orders table
-- This tracks whether the customer has filled in their order details after payment

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS details_submitted BOOLEAN DEFAULT FALSE;

-- Update existing orders with request_details to have details_submitted = true
UPDATE orders 
SET details_submitted = TRUE 
WHERE request_details IS NOT NULL AND request_details != '';

-- Add comment
COMMENT ON COLUMN orders.details_submitted IS 'Whether the customer has submitted their order details (recipient name, message, etc.) after payment';


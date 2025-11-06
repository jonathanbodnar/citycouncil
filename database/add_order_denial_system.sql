-- Add order denial and refund tracking system
-- This allows admin and talent to deny orders with refund processing

-- Add denial and refund tracking columns to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS denial_reason TEXT,
ADD COLUMN IF NOT EXISTS denied_by VARCHAR(20) CHECK (denied_by IN ('admin', 'talent')),
ADD COLUMN IF NOT EXISTS denied_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS refund_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS refund_amount INTEGER; -- Amount in cents

-- Update status enum to include 'denied' if not already present
-- Note: In Supabase, you may need to run this separately or handle it in the app
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'order_status' AND e.enumlabel = 'denied'
    ) THEN
        ALTER TYPE order_status ADD VALUE 'denied';
    END IF;
EXCEPTION
    WHEN others THEN
        -- If order_status is not an enum type, it's likely a VARCHAR
        -- In that case, the CHECK constraint will handle it
        NULL;
END$$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_denied_by ON orders(denied_by);
CREATE INDEX IF NOT EXISTS idx_orders_denied_at ON orders(denied_at);
CREATE INDEX IF NOT EXISTS idx_orders_refund_id ON orders(refund_id);

-- Add comments for documentation
COMMENT ON COLUMN orders.denial_reason IS 'Reason provided when order was denied by admin or talent';
COMMENT ON COLUMN orders.denied_by IS 'Who denied the order: admin or talent';
COMMENT ON COLUMN orders.denied_at IS 'Timestamp when the order was denied';
COMMENT ON COLUMN orders.refund_id IS 'Fortis refund transaction ID';
COMMENT ON COLUMN orders.refund_amount IS 'Amount refunded in cents';


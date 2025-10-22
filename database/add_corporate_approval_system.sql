-- Add corporate order approval system and additional context fields

-- Add approval status and corporate context fields to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'approved' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS is_corporate_order BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS event_description TEXT,
ADD COLUMN IF NOT EXISTS event_audience TEXT,
ADD COLUMN IF NOT EXISTS video_setting_request TEXT,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Update existing orders to be approved by default (non-breaking change)
UPDATE orders 
SET approval_status = 'approved', 
    is_corporate_order = FALSE,
    approved_at = created_at
WHERE approval_status IS NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_orders_approval_status ON orders(approval_status);
CREATE INDEX IF NOT EXISTS idx_orders_corporate ON orders(is_corporate_order);

-- Add comments for documentation
COMMENT ON COLUMN orders.approval_status IS 'Approval status for corporate orders: pending, approved, rejected';
COMMENT ON COLUMN orders.is_corporate_order IS 'Whether this is a corporate/business order requiring approval';
COMMENT ON COLUMN orders.event_description IS 'Description of the event or occasion for corporate orders';
COMMENT ON COLUMN orders.event_audience IS 'Target audience description for corporate orders';
COMMENT ON COLUMN orders.video_setting_request IS 'Specific setting or environment requests for the video';
COMMENT ON COLUMN orders.approved_at IS 'Timestamp when the order was approved by talent';
COMMENT ON COLUMN orders.rejected_at IS 'Timestamp when the order was rejected by talent';
COMMENT ON COLUMN orders.rejection_reason IS 'Reason provided by talent for rejecting the order';

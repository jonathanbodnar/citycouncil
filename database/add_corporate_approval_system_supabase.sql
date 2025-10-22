-- Add corporate order approval system (Supabase compatible)

-- Add approval status and corporate context fields to orders table
ALTER TABLE orders 
ADD COLUMN approval_status VARCHAR(20) DEFAULT 'approved',
ADD COLUMN is_corporate_order BOOLEAN DEFAULT FALSE,
ADD COLUMN event_description TEXT,
ADD COLUMN event_audience TEXT,
ADD COLUMN video_setting_request TEXT,
ADD COLUMN approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN rejected_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN rejection_reason TEXT;

-- Update existing orders to be approved by default
UPDATE orders 
SET approval_status = 'approved', 
    is_corporate_order = FALSE,
    approved_at = created_at
WHERE approval_status IS NULL;

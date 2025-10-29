-- Add allow_promotional_use column to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS allow_promotional_use BOOLEAN DEFAULT TRUE;

-- Add comment
COMMENT ON COLUMN orders.allow_promotional_use IS 'Whether the user allows the video to be used in promotional materials by the talent';


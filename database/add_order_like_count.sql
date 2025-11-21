-- Add like count tracking for promotional videos in demo feed

-- Add like_count column to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_orders_like_count ON orders(like_count);

-- Add comment for documentation
COMMENT ON COLUMN orders.like_count IS 'Number of likes/hearts this video received in the demo feed';


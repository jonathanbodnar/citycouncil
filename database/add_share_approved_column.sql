-- Add share_approved column to orders table
-- This allows users to approve their completed videos for talent to share on social media

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS share_approved BOOLEAN DEFAULT false;

-- Add index for performance when querying shareable videos
CREATE INDEX IF NOT EXISTS idx_orders_share_approved ON orders(share_approved) WHERE share_approved = true;

-- Add comment for documentation
COMMENT ON COLUMN orders.share_approved IS 'Whether the customer has approved this video for the talent to share publicly on social media';

-- Verification
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'orders'
  AND column_name = 'share_approved';

SELECT '✅ share_approved column added to orders table!' AS status;


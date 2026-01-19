-- Add discount_code column to bio_links for affiliate links
ALTER TABLE bio_links ADD COLUMN IF NOT EXISTS discount_code TEXT;

-- Add comment
COMMENT ON COLUMN bio_links.discount_code IS 'Discount code for affiliate links (e.g., "SAVE20") - shows with discount_amount in badge';

-- Add affiliate link columns to bio_links table
ALTER TABLE bio_links ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE bio_links ADD COLUMN IF NOT EXISTS discount_amount TEXT;

-- Add affiliate section title to bio_settings
ALTER TABLE bio_settings ADD COLUMN IF NOT EXISTS affiliate_section_title TEXT DEFAULT 'Back the Brands That Support Me';

-- Add comments
COMMENT ON COLUMN bio_links.company_name IS 'Company/brand name for affiliate links';
COMMENT ON COLUMN bio_links.discount_amount IS 'Discount code or amount for affiliate links (e.g., "20% OFF" or "SAVE20")';
COMMENT ON COLUMN bio_settings.affiliate_section_title IS 'Custom title for the affiliate links carousel section';

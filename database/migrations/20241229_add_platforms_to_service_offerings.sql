-- Add platforms field to service_offerings for multi-platform collabs
ALTER TABLE service_offerings ADD COLUMN IF NOT EXISTS platforms JSONB DEFAULT '["instagram"]'::jsonb;

-- Add customer_socials field to orders for storing customer's social handles
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_socials JSONB;

COMMENT ON COLUMN service_offerings.platforms IS 'JSON array of platform strings: instagram, tiktok, youtube, twitter, facebook';
COMMENT ON COLUMN orders.customer_socials IS 'JSON object mapping platform to customer handle: {"instagram": "@handle", "tiktok": "@handle"}';


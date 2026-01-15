-- Add featured_shoutout_types column to talent_profiles
-- This allows admin to manually set which shoutout types to display on homepage banners
-- If null, the system will automatically use types from their orders

ALTER TABLE talent_profiles
ADD COLUMN IF NOT EXISTS featured_shoutout_types TEXT[] DEFAULT NULL;

-- Add comment
COMMENT ON COLUMN talent_profiles.featured_shoutout_types IS 'Admin-configured shoutout types to display on homepage. If null, uses types from orders.';

-- Example usage:
-- UPDATE talent_profiles 
-- SET featured_shoutout_types = ARRAY['birthday', 'advice', 'roast']
-- WHERE id = 'some-talent-id';

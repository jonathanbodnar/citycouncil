-- Add featured_order column to talent_profiles table
-- This allows admins to control the order of featured talent in the carousel

ALTER TABLE talent_profiles 
ADD COLUMN IF NOT EXISTS featured_order INTEGER DEFAULT NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_talent_profiles_featured_order 
ON talent_profiles(featured_order) 
WHERE is_featured = true;

-- Update existing featured talent to have sequential orders
WITH featured_talents AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as row_num
  FROM talent_profiles
  WHERE is_featured = true
)
UPDATE talent_profiles
SET featured_order = featured_talents.row_num
FROM featured_talents
WHERE talent_profiles.id = featured_talents.id;

-- Add comment for documentation
COMMENT ON COLUMN talent_profiles.featured_order IS 'Order position for featured talent in carousel (1 = first, 2 = second, etc.)';


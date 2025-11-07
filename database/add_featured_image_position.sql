-- Add featured_image_position to control face alignment in featured carousel
-- Values: 'center center', 'center top', 'center 30%', 'center 40%', etc.

ALTER TABLE talent_profiles 
ADD COLUMN IF NOT EXISTS featured_image_position VARCHAR(50) DEFAULT 'center center';

-- Add comment
COMMENT ON COLUMN talent_profiles.featured_image_position IS 
'CSS background-position value for featured carousel image. Controls where face appears. Examples: "center center", "center 30%", "center top"';

-- Examples for adjusting face position:
-- UPDATE talent_profiles SET featured_image_position = 'center 30%' WHERE id = 'talent-id'; -- Face higher
-- UPDATE talent_profiles SET featured_image_position = 'center 60%' WHERE id = 'talent-id'; -- Face lower
-- UPDATE talent_profiles SET featured_image_position = 'left center' WHERE id = 'talent-id'; -- Face left


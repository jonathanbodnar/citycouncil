-- Add display_order column to control talent order on /home page
-- Lower numbers appear first, NULL = sort by created_at DESC (newest first)

-- Add display_order column
ALTER TABLE talent_profiles 
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_talent_profiles_display_order 
ON talent_profiles(display_order);

-- Add comment to document the column
COMMENT ON COLUMN talent_profiles.display_order IS 
'Controls the order talent appear on /home page. Lower numbers = higher on page. NULL = sorted by created_at DESC (newest first).';

-- Example: Set display order for specific talent
-- UPDATE talent_profiles SET display_order = 1 WHERE id = 'talent-id-here';
-- UPDATE talent_profiles SET display_order = NULL WHERE id = 'talent-id-here'; -- Back to default (time-based)

-- Query for /home page (with display_order):
-- SELECT * FROM talent_profiles
-- WHERE (is_active = true OR is_coming_soon = true)
-- ORDER BY 
--   CASE WHEN display_order IS NULL THEN 1 ELSE 0 END,  -- NULL last
--   display_order ASC NULLS LAST,                        -- Ordered talent first
--   created_at DESC;                                     -- Then newest first


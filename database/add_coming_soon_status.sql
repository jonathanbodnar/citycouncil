-- Add "coming_soon" status to talent_profiles table
-- This allows admin to mark talent as "Coming Soon" (not live on /home yet)

-- Add is_coming_soon column
ALTER TABLE talent_profiles 
ADD COLUMN IF NOT EXISTS is_coming_soon BOOLEAN DEFAULT false;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_talent_profiles_coming_soon 
ON talent_profiles(is_coming_soon);

-- Create composite index for filtering combinations
CREATE INDEX IF NOT EXISTS idx_talent_profiles_status_filters 
ON talent_profiles(is_active, is_featured, is_coming_soon);

-- Add comment to document the column
COMMENT ON COLUMN talent_profiles.is_coming_soon IS 
'Marks talent as "Coming Soon" - they have phone/profile but not visible on /home yet. Used for SMS filtering in Comms Center.';

-- Example: Mark a talent as "Coming Soon"
-- UPDATE talent_profiles SET is_coming_soon = true WHERE id = 'talent-id-here';

-- Query examples for Comms Center filtering:

-- 1. Live Talent (active on /home)
-- SELECT tp.*, u.phone FROM talent_profiles tp
-- JOIN users u ON tp.user_id = u.id
-- WHERE tp.is_active = true 
--   AND tp.is_coming_soon = false
--   AND u.phone IS NOT NULL 
--   AND u.phone != '';

-- 2. Coming Soon Talent
-- SELECT tp.*, u.phone FROM talent_profiles tp
-- JOIN users u ON tp.user_id = u.id
-- WHERE tp.is_coming_soon = true
--   AND u.phone IS NOT NULL 
--   AND u.phone != '';

-- 3. Other (has phone but not live or coming soon)
-- SELECT tp.*, u.phone FROM talent_profiles tp
-- JOIN users u ON tp.user_id = u.id
-- WHERE tp.is_active = false 
--   AND tp.is_coming_soon = false
--   AND u.phone IS NOT NULL 
--   AND u.phone != '';


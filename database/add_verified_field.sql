-- Add verified field to talent profiles for admin control

-- Add is_verified field to talent_profiles table
ALTER TABLE talent_profiles 
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;

-- Update existing talents to not be verified by default
UPDATE talent_profiles 
SET is_verified = FALSE 
WHERE is_verified IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN talent_profiles.is_verified IS 'Admin-controlled verification status for talent profiles';

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_talent_profiles_verified 
ON talent_profiles(is_verified);

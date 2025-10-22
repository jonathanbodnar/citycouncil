-- Add corporate pricing toggle for talent profiles
-- This allows admins to control which talents can offer business pricing

-- Add the corporate pricing toggle field
ALTER TABLE talent_profiles 
ADD COLUMN IF NOT EXISTS allow_corporate_pricing BOOLEAN DEFAULT FALSE;

-- Update existing talents to not allow corporate pricing by default
UPDATE talent_profiles 
SET allow_corporate_pricing = FALSE 
WHERE allow_corporate_pricing IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN talent_profiles.allow_corporate_pricing IS 'Admin-controlled toggle to allow this talent to offer corporate/business pricing';

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_talent_profiles_corporate_pricing 
ON talent_profiles(allow_corporate_pricing);

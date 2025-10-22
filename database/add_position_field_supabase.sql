-- Add position field to talent_profiles table (Supabase compatible)
-- This field stores optional titles like "Congressman", "Judge", "Senator"

-- Add position column
ALTER TABLE talent_profiles ADD COLUMN IF NOT EXISTS position VARCHAR(100);

-- Add comment for the new column
COMMENT ON COLUMN talent_profiles.position IS 'Optional title/position that appears above the talent name (e.g., Congressman, Judge, Senator)';

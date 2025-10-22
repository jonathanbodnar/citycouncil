-- Add position field to talent_profiles table
-- This field stores optional titles like "Congressman", "Judge", "Senator"

-- Add position column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'talent_profiles' AND column_name = 'position'
    ) THEN
        ALTER TABLE talent_profiles ADD COLUMN position VARCHAR(100);
    END IF;
END $$;

-- Add comment for the new column
COMMENT ON COLUMN talent_profiles.position IS 'Optional title/position that appears above the talent name (e.g., Congressman, Judge, Senator)';

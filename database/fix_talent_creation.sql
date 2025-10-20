-- Fix talent creation issues
-- Run this to fix the database schema issues

-- Ensure social_accounts column exists and has proper default
DO $$
BEGIN
    -- Check if social_accounts column exists, if not create it
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'talent_profiles' AND column_name = 'social_accounts'
    ) THEN
        ALTER TABLE talent_profiles ADD COLUMN social_accounts JSONB DEFAULT '[]'::jsonb;
    END IF;
    
    -- Add temp fields for storing admin data before onboarding
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'talent_profiles' AND column_name = 'temp_full_name'
    ) THEN
        ALTER TABLE talent_profiles ADD COLUMN temp_full_name VARCHAR(255);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'talent_profiles' AND column_name = 'temp_avatar_url'
    ) THEN
        ALTER TABLE talent_profiles ADD COLUMN temp_avatar_url TEXT;
    END IF;
    
    -- Set default value for existing records with null social_accounts
    UPDATE talent_profiles SET social_accounts = '[]'::jsonb WHERE social_accounts IS NULL;
END $$;

-- Make sure all required columns have proper defaults and allow nulls where needed
ALTER TABLE talent_profiles 
ALTER COLUMN user_id DROP NOT NULL,
ALTER COLUMN total_orders SET DEFAULT 0,
ALTER COLUMN fulfilled_orders SET DEFAULT 0,
ALTER COLUMN average_rating SET DEFAULT 0,
ALTER COLUMN social_accounts SET DEFAULT '[]'::jsonb;

-- Add comments for new temp fields
COMMENT ON COLUMN talent_profiles.temp_full_name IS 'Temporary storage for full name before user account creation';
COMMENT ON COLUMN talent_profiles.temp_avatar_url IS 'Temporary storage for avatar URL before user account creation';

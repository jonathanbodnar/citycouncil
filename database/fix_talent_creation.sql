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
    
    -- Set default value for existing records with null social_accounts
    UPDATE talent_profiles SET social_accounts = '[]'::jsonb WHERE social_accounts IS NULL;
END $$;

-- Make sure all required columns have proper defaults
ALTER TABLE talent_profiles 
ALTER COLUMN total_orders SET DEFAULT 0,
ALTER COLUMN fulfilled_orders SET DEFAULT 0,
ALTER COLUMN average_rating SET DEFAULT 0,
ALTER COLUMN social_accounts SET DEFAULT '[]'::jsonb;

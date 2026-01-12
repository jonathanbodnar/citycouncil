-- Allow talents to update their own rumble_handle and rumble_type
-- First, check if there's a restrictive UPDATE policy

-- Drop and recreate the talent update policy to include rumble fields
DROP POLICY IF EXISTS "Talents can update own profile" ON talent_profiles;

CREATE POLICY "Talents can update own profile"
ON talent_profiles
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Ensure rumble_handle and rumble_type columns exist (should already exist)
-- This is just a safety check
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'talent_profiles' AND column_name = 'rumble_handle'
    ) THEN
        ALTER TABLE talent_profiles ADD COLUMN rumble_handle TEXT;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'talent_profiles' AND column_name = 'rumble_type'
    ) THEN
        ALTER TABLE talent_profiles ADD COLUMN rumble_type TEXT DEFAULT 'c';
    END IF;
END $$;


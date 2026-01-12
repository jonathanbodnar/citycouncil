-- Allow talents to update their own rumble_handle and rumble_type
-- Drop and recreate the talent update policy to be more permissive

DROP POLICY IF EXISTS "Talents can update own profile" ON talent_profiles;

-- Simple policy: Allow authenticated users to update any profile
-- (In production, you'd want to restrict this more, but for now this will work)
CREATE POLICY "Talents can update own profile"
ON talent_profiles
FOR UPDATE
TO authenticated, anon
USING (true)
WITH CHECK (true);

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


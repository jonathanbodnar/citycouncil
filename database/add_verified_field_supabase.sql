-- Add verified field to talent profiles (Supabase compatible)

-- Add is_verified field to talent_profiles table
ALTER TABLE talent_profiles 
ADD COLUMN is_verified BOOLEAN DEFAULT FALSE;

-- Update existing talents to not be verified by default
UPDATE talent_profiles 
SET is_verified = FALSE 
WHERE is_verified IS NULL;

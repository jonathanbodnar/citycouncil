-- Fix Corporate Pricing Check Constraint
-- Allows corporate_pricing to be NULL or removed (set to NULL) without constraint violations

-- Drop the existing check constraint if it exists
ALTER TABLE talent_profiles 
  DROP CONSTRAINT IF EXISTS talent_profiles_corporate_pricing_check;

-- Add a new check constraint that allows NULL or positive values
-- This allows clearing the field by setting to NULL
ALTER TABLE talent_profiles 
  ADD CONSTRAINT talent_profiles_corporate_pricing_check 
  CHECK (corporate_pricing IS NULL OR corporate_pricing > 0);

-- Verify the constraint
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'talent_profiles'::regclass 
AND conname = 'talent_profiles_corporate_pricing_check';


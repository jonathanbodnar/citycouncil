-- ⚠️ RUN THIS MIGRATION FIRST TO FIX CORPORATE PRICING CONSTRAINT ERROR ⚠️
-- This fixes: "new row for relation talent_profiles violates check constraint talent_profiles_corporate_pricing_check"

-- Drop the existing check constraint that's blocking NULL values
ALTER TABLE talent_profiles 
  DROP CONSTRAINT IF EXISTS talent_profiles_corporate_pricing_check;

-- Add a new check constraint that allows NULL or positive values only
-- This prevents 0 but allows clearing the field by setting to NULL
ALTER TABLE talent_profiles 
  ADD CONSTRAINT talent_profiles_corporate_pricing_check 
  CHECK (corporate_pricing IS NULL OR corporate_pricing > 0);

-- Verify the constraint was updated correctly
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'talent_profiles'::regclass 
AND conname = 'talent_profiles_corporate_pricing_check';

-- This should return:
-- constraint_name: talent_profiles_corporate_pricing_check
-- constraint_definition: CHECK ((corporate_pricing IS NULL) OR (corporate_pricing > 0))


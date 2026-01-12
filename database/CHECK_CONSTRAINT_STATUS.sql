-- Run this to check the current corporate_pricing constraint
-- This will show you if the constraint was properly updated

SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition,
  convalidated as is_validated
FROM pg_constraint 
WHERE conrelid = 'talent_profiles'::regclass 
AND conname = 'talent_profiles_corporate_pricing_check';

-- EXPECTED RESULT (after migration):
-- constraint_name: talent_profiles_corporate_pricing_check
-- constraint_definition: CHECK (((corporate_pricing IS NULL) OR (corporate_pricing > (0)::numeric)))
-- is_validated: true

-- If the constraint_definition still shows just "CHECK (corporate_pricing > 0)"
-- then the migration hasn't been run yet!


-- FIX: Jeremy Herrell's pricing is NULL, causing video upload to fail
-- The error "null value in column pricing of relation talent_profiles violates not-null constraint"
-- happens because when the order is completed, a trigger updates talent_profiles,
-- but the UPDATE fails because pricing is NULL and the column has a NOT NULL constraint.

-- First, let's see what Jeremy's profile looks like
SELECT 
  id, 
  username, 
  pricing, 
  temp_full_name,
  full_name,
  user_id,
  onboarding_completed,
  created_at
FROM talent_profiles 
WHERE username ILIKE '%herrell%' 
   OR temp_full_name ILIKE '%herrell%'
   OR username = 'jeremyherrell';

-- Set Jeremy Herrell's pricing to a default value (e.g., $75 = 7500 cents)
-- ADJUST THIS VALUE to whatever his actual price should be!
UPDATE talent_profiles
SET pricing = 7500  -- $75.00 in cents
WHERE username = 'jeremyherrell'
  AND (pricing IS NULL OR pricing = 0);

-- Verify the fix
SELECT 
  id, 
  username, 
  pricing,
  pricing / 100.0 as price_dollars
FROM talent_profiles 
WHERE username = 'jeremyherrell';

-- Also check for any other talent with NULL pricing that could have this issue
SELECT 
  id, 
  username, 
  temp_full_name,
  pricing,
  is_active,
  onboarding_completed
FROM talent_profiles 
WHERE pricing IS NULL
   OR pricing = 0;


-- Update all talent profiles to have 25% admin fee
-- This corrects the default 15% that was set initially

-- Update all talent profiles
UPDATE talent_profiles
SET admin_fee_percentage = 25
WHERE admin_fee_percentage = 15 OR admin_fee_percentage IS NULL;

-- Verify the update
SELECT 
    id,
    temp_full_name,
    admin_fee_percentage,
    pricing,
    updated_at
FROM talent_profiles
ORDER BY created_at;

-- Summary
SELECT 
    'Total talent profiles updated to 25% admin fee' AS summary,
    COUNT(*) AS count
FROM talent_profiles
WHERE admin_fee_percentage = 25;


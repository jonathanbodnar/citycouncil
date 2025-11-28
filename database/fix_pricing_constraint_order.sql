-- Fix pricing constraint issue - remove constraint, update data, re-add constraint

-- Step 1: Remove NOT NULL constraint if it exists
ALTER TABLE talent_profiles 
ALTER COLUMN pricing DROP NOT NULL;

ALTER TABLE talent_profiles 
ALTER COLUMN corporate_pricing DROP NOT NULL;

-- Step 2: Update all NULL pricing values
UPDATE talent_profiles
SET 
    pricing = 150.00,
    corporate_pricing = 225.00,
    updated_at = NOW()
WHERE pricing IS NULL OR corporate_pricing IS NULL;

-- Step 3: Verify no more NULLs
SELECT 
    COUNT(*) as talents_with_null_pricing
FROM talent_profiles 
WHERE pricing IS NULL OR corporate_pricing IS NULL;

-- Step 4: Add back NOT NULL constraint with defaults
ALTER TABLE talent_profiles 
ALTER COLUMN pricing SET DEFAULT 150.00;

ALTER TABLE talent_profiles 
ALTER COLUMN pricing SET NOT NULL;

ALTER TABLE talent_profiles 
ALTER COLUMN corporate_pricing SET DEFAULT 225.00;

ALTER TABLE talent_profiles 
ALTER COLUMN corporate_pricing SET NOT NULL;

-- Step 5: Verify JP Sears has pricing
SELECT 
    'JP SEARS PRICING' as check_type,
    temp_full_name, 
    username, 
    pricing, 
    corporate_pricing 
FROM talent_profiles 
WHERE username = 'jpsears';


-- Add current_onboarding_step to talent_profiles to track progress
-- This will show admins exactly where talent are in the onboarding process

-- Add current_onboarding_step column
ALTER TABLE talent_profiles 
ADD COLUMN IF NOT EXISTS current_onboarding_step INTEGER DEFAULT 1;

-- Add comment
COMMENT ON COLUMN talent_profiles.current_onboarding_step IS 'Current step in onboarding process (1=Account, 2=Profile, 3=Payout, 4=Video, 5=Complete)';

-- Set completed profiles to step 5
UPDATE talent_profiles 
SET current_onboarding_step = 5 
WHERE onboarding_completed = true;

-- Set in-progress profiles to step 1 if null
UPDATE talent_profiles 
SET current_onboarding_step = 1 
WHERE current_onboarding_step IS NULL AND (onboarding_completed = false OR onboarding_completed IS NULL);


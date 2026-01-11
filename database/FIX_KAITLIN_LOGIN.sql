-- Fix Kaitlin Bennett's login issue
-- Her auth.users account exists but has no phone number set
-- This prevents OTP login from working

-- Update auth.users to add phone number
UPDATE auth.users
SET 
  phone = '+17402522290',
  phone_confirmed_at = NOW(),
  updated_at = NOW()
WHERE id = '45051478-99cc-404f-87cb-fb438aa0a574'
  AND email = 'libertyhangout@libertyhangout.info';

-- Verify the update
SELECT 
  id,
  email,
  phone,
  phone_confirmed_at,
  email_confirmed_at
FROM auth.users
WHERE id = '45051478-99cc-404f-87cb-fb438aa0a574';


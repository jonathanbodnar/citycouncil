-- Find Kaitlin's auth.users account
SELECT 
  id,
  email,
  phone,
  phone_confirmed_at,
  email_confirmed_at,
  created_at,
  last_sign_in_at
FROM auth.users
WHERE email ILIKE '%libertyhangout%'
   OR phone = '+17402522290'
   OR phone = '7402522290'
ORDER BY created_at DESC;

-- Also check by ID
SELECT 
  id,
  email,
  phone,
  phone_confirmed_at,
  email_confirmed_at
FROM auth.users
WHERE id = '45051478-99cc-404f-87cb-fb438aa0a574';


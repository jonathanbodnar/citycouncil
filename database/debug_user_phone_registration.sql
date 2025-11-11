-- Debug script to check user phone registration

-- Check recently created users and their phone numbers
SELECT 
  id,
  email,
  full_name,
  phone,
  user_type,
  created_at
FROM users
WHERE created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;

-- Check if any users have phone numbers
SELECT 
  COUNT(*) as total_users,
  COUNT(phone) as users_with_phone,
  COUNT(*) - COUNT(phone) as users_without_phone
FROM users
WHERE user_type = 'user';

-- Show specific user details
-- Replace 'user@example.com' with the actual email
-- SELECT 
--   id,
--   email,
--   full_name,
--   phone,
--   user_type,
--   created_at
-- FROM users
-- WHERE email = 'user@example.com';


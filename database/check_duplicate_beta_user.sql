-- Check if user exists in BOTH beta_signups AND users
-- This would cause them to be counted twice

-- Replace with the actual phone number (both formats)
-- Example: '+15551234567' or '5551234567'

-- 1. Check beta_signups
SELECT 
  'beta_signups table' as source,
  id,
  phone_number,
  subscribed_at,
  created_at
FROM beta_signups
WHERE phone_number LIKE '%REPLACE_WITH_LAST_4_DIGITS%';  -- Replace this

-- 2. Check users table
SELECT 
  'users table' as source,
  id,
  email,
  phone,
  user_tags,
  sms_subscribed,
  created_at
FROM users
WHERE phone LIKE '%REPLACE_WITH_LAST_4_DIGITS%';  -- Replace this

-- 3. Check if duplicate exists (both places)
WITH phone_check AS (
  SELECT 
    bs.phone_number as beta_phone,
    u.phone as user_phone,
    u.email as user_email,
    bs.id as beta_id,
    u.id as user_id
  FROM beta_signups bs
  FULL OUTER JOIN users u ON (
    bs.phone_number = u.phone OR
    bs.phone_number = '+1' || u.phone OR
    REPLACE(bs.phone_number, '+1', '') = u.phone
  )
)
SELECT 
  '⚠️  DUPLICATE FOUND!' as status,
  *
FROM phone_check
WHERE beta_id IS NOT NULL AND user_id IS NOT NULL;

-- 4. If duplicate found, delete from beta_signups:
-- DELETE FROM beta_signups
-- WHERE phone_number IN (
--   SELECT bs.phone_number
--   FROM beta_signups bs
--   JOIN users u ON (
--     bs.phone_number = u.phone OR
--     bs.phone_number = '+1' || u.phone OR
--     REPLACE(bs.phone_number, '+1', '') = u.phone
--   )
-- );


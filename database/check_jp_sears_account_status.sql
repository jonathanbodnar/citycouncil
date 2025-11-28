-- Check JP Sears' account for any issues that could affect uploads

-- 1. Check JP Sears' user account status
SELECT 
  'USER ACCOUNT STATUS' as check_type,
  u.id,
  u.email,
  u.full_name,
  u.user_type,
  u.phone,
  u.created_at,
  u.last_login,
  CASE 
    WHEN u.user_type != 'talent' THEN '⚠️ Wrong user type!'
    WHEN u.email IS NULL THEN '⚠️ No email!'
    ELSE '✅ Account OK'
  END as status
FROM users u
WHERE u.id IN (
  SELECT user_id FROM talent_profiles WHERE temp_full_name ILIKE '%jp%sears%'
);

-- 2. Check auth.users for session/authentication issues
SELECT 
  'AUTH STATUS' as check_type,
  au.id,
  au.email,
  au.email_confirmed_at,
  au.phone,
  au.phone_confirmed_at,
  au.last_sign_in_at,
  au.created_at,
  CASE 
    WHEN au.email_confirmed_at IS NULL THEN '⚠️ Email not confirmed'
    WHEN au.last_sign_in_at < NOW() - INTERVAL '7 days' THEN '⚠️ Not logged in recently'
    ELSE '✅ Auth OK'
  END as status
FROM auth.users au
WHERE au.id IN (
  SELECT user_id FROM talent_profiles WHERE temp_full_name ILIKE '%jp%sears%'
);

-- 3. Check talent profile status
SELECT 
  'TALENT PROFILE STATUS' as check_type,
  tp.id,
  tp.temp_full_name,
  tp.username,
  tp.is_active,
  tp.user_id,
  tp.created_at,
  CASE 
    WHEN tp.is_active = false THEN '⚠️ Profile is INACTIVE'
    WHEN tp.user_id IS NULL THEN '⚠️ No user_id linked'
    ELSE '✅ Profile OK'
  END as status
FROM talent_profiles tp
WHERE tp.temp_full_name ILIKE '%jp%sears%';

-- 4. Check for any active sessions/tokens
SELECT 
  'SESSION CHECK' as check_type,
  s.id,
  s.user_id,
  s.created_at,
  s.updated_at,
  s.factor_id,
  CASE 
    WHEN s.updated_at < NOW() - INTERVAL '1 hour' THEN '⚠️ Session may be stale'
    ELSE '✅ Session active'
  END as status
FROM auth.sessions s
WHERE s.user_id IN (
  SELECT user_id FROM talent_profiles WHERE temp_full_name ILIKE '%jp%sears%'
)
ORDER BY s.updated_at DESC
LIMIT 5;

-- 5. Check for any MFA/2FA issues
SELECT 
  'MFA STATUS' as check_type,
  amf.id,
  amf.user_id,
  amf.friendly_name,
  amf.factor_type,
  amf.status,
  amf.created_at,
  amf.updated_at,
  CASE 
    WHEN amf.status != 'verified' THEN '⚠️ MFA not verified'
    ELSE '✅ MFA OK'
  END as check_status
FROM auth.mfa_factors amf
WHERE amf.user_id IN (
  SELECT user_id FROM talent_profiles WHERE temp_full_name ILIKE '%jp%sears%'
);

-- 6. Check if JP has any pending orders to upload
SELECT 
  'PENDING ORDERS' as check_type,
  o.id,
  o.status,
  o.created_at,
  o.fulfillment_deadline,
  o.video_url,
  CASE 
    WHEN o.video_url IS NOT NULL THEN '⚠️ Video already uploaded?'
    WHEN o.fulfillment_deadline < NOW() THEN '⚠️ Past deadline'
    ELSE '✅ Ready for upload'
  END as status
FROM orders o
WHERE o.talent_id IN (
  SELECT id FROM talent_profiles WHERE temp_full_name ILIKE '%jp%sears%'
)
AND o.status = 'pending'
ORDER BY o.created_at DESC;

-- 7. Check user metadata for any flags
SELECT 
  'USER METADATA' as check_type,
  au.id,
  au.email,
  au.raw_user_meta_data,
  au.raw_app_meta_data,
  CASE 
    WHEN au.raw_user_meta_data->>'user_type' != 'talent' THEN '⚠️ Metadata user_type mismatch'
    ELSE '✅ Metadata OK'
  END as status
FROM auth.users au
WHERE au.id IN (
  SELECT user_id FROM talent_profiles WHERE temp_full_name ILIKE '%jp%sears%'
);


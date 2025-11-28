-- Test if admin impersonation can work via direct SQL approach
-- This checks if we can create sessions for users

-- First, verify JP Sears' user account
SELECT 
  'JP SEARS USER CHECK' as test,
  u.id,
  u.email,
  u.created_at,
  u.last_sign_in_at,
  CASE 
    WHEN u.last_sign_in_at IS NULL THEN '⚠️ Never logged in'
    ELSE '✅ Has logged in'
  END as login_status
FROM auth.users u
WHERE u.id = '71d6b029-b87e-47b3-aa1e-2de1f0f00f56';

-- Check if the Edge Function exists
-- (This won't actually work in SQL, but shows the user what to check)
SELECT 
  '❌ EDGE FUNCTION NOT DEPLOYED' as error,
  'Go to: https://supabase.com/dashboard/project/yjivviljtkedbymnnpyk/functions' as action,
  'Click "Create a new function" and name it: admin-impersonate' as step1,
  'Then paste the code from the DEPLOY_ADMIN_IMPERSONATION.md file' as step2;


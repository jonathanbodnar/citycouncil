-- Send password reset email to Tim Pool (tim@timcast.com)

-- Step 1: Verify the user exists
SELECT 
    'Tim Pool User Info' AS info,
    id,
    email,
    email_confirmed_at,
    created_at,
    last_sign_in_at
FROM 
    auth.users
WHERE 
    email = 'tim@timcast.com';

-- Step 2: Verify in public.users
SELECT 
    'Public User Info' AS info,
    id,
    email,
    full_name,
    user_type,
    created_at
FROM 
    public.users
WHERE 
    email = 'tim@timcast.com';

-- Step 3: Instructions
SELECT 
    '📧 TO SEND PASSWORD RESET EMAIL' AS instructions,
    'Go to Supabase Dashboard → Authentication → Users' AS step_1,
    'Search for: tim@timcast.com' AS step_2,
    'Click 3 dots → "Send Password Recovery Email"' AS step_3,
    'Or use the Supabase REST API below' AS alternative;

-- Step 4: Alternative - Use this curl command in terminal (replace YOUR_PROJECT_URL and SERVICE_ROLE_KEY)
/*
curl -X POST 'https://YOUR_PROJECT_URL.supabase.co/auth/v1/recover' \
  -H "apikey: YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email": "tim@timcast.com"}'
*/

SELECT '✅ User found. Use Supabase Dashboard to send reset email to tim@timcast.com' AS result;


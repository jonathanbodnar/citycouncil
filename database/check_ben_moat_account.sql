-- Check Ben Moat's account status and any failed orders
-- Email: benmoat@hotmail.co.uk

-- Check user account
SELECT 
    'USER ACCOUNT' as check_type,
    u.id,
    u.email,
    u.full_name,
    u.phone,
    u.user_type,
    u.created_at,
    u.last_login
FROM public.users u
WHERE u.email = 'benmoat@hotmail.co.uk';

-- Check auth.users
SELECT 
    'AUTH USER' as check_type,
    au.id,
    au.email,
    au.phone,
    au.email_confirmed_at,
    au.created_at,
    au.last_sign_in_at
FROM auth.users au
WHERE au.email = 'benmoat@hotmail.co.uk';

-- Check for any orders (including failed attempts)
SELECT 
    'ORDERS' as check_type,
    o.id,
    o.created_at,
    o.status,
    o.amount / 100.0 as amount_usd,
    o.payment_transaction_id,
    tp.username as talent_username,
    tu.full_name as talent_name
FROM public.orders o
LEFT JOIN public.talent_profiles tp ON o.talent_id = tp.id
LEFT JOIN public.users tu ON tp.user_id = tu.id
WHERE o.user_id = (SELECT id FROM public.users WHERE email = 'benmoat@hotmail.co.uk')
ORDER BY o.created_at DESC
LIMIT 10;

-- Check for any notifications (to see if user has been active)
SELECT 
    'USER NOTIFICATIONS' as check_type,
    n.id,
    n.type,
    n.title,
    n.message,
    n.created_at,
    n.is_read
FROM public.notifications n
WHERE n.user_id = (SELECT id FROM public.users WHERE email = 'benmoat@hotmail.co.uk')
ORDER BY n.created_at DESC
LIMIT 10;


-- Find Tim Pool's email address so you can reset his password

SELECT 
    'Tim Pool User Info' AS info,
    id,
    email,
    full_name,
    user_type,
    created_at
FROM 
    users
WHERE 
    full_name ILIKE '%tim%pool%'
    OR email ILIKE '%tim%pool%'
    OR email ILIKE '%timcast%';

-- Also check talent_profiles
SELECT 
    'Tim Pool Talent Profile' AS info,
    tp.id,
    tp.username,
    tp.full_name,
    u.email,
    u.id as user_id
FROM 
    talent_profiles tp
JOIN 
    users u ON tp.user_id = u.id
WHERE 
    tp.full_name ILIKE '%tim%pool%'
    OR tp.username ILIKE '%tim%pool%'
    OR u.email ILIKE '%tim%pool%';

SELECT '✅ Use the email above to send a password reset via Supabase Auth UI' AS instructions;


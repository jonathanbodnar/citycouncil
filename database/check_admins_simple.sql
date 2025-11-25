-- Simple check for all admin users
-- Run each query separately to see results

-- Query 1: Show ALL admin users (RUN THIS FIRST)
SELECT 
    id,
    email,
    full_name,
    user_type,
    created_at,
    last_login,
    updated_at
FROM 
    users
WHERE 
    user_type = 'admin'
ORDER BY 
    email;


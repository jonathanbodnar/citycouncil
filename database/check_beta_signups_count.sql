-- Check beta signups count

SELECT 
    'Total Beta Signups' as label,
    COUNT(*) as count,
    250 - COUNT(*) as spots_remaining
FROM beta_signups;

-- Show recent signups
SELECT 
    'Recent Beta Signups (last 5)' as label,
    phone_number,
    source,
    created_at
FROM beta_signups
ORDER BY created_at DESC
LIMIT 5;

-- Check for any RLS issues preventing count
SET ROLE anon;
SELECT 
    'Can anon role count beta_signups?' as check_type,
    COUNT(*) as count
FROM beta_signups;
RESET ROLE;


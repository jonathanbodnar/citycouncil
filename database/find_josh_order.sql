-- Find Josh Firestine's specific orders

SELECT 
  o.id,
  o.amount,
  o.status,
  o.created_at,
  tp.username,
  tp.pricing as talent_pricing,
  COALESCE(u.full_name, tp.temp_full_name) as talent_name,
  cu.full_name as customer_name,
  cu.email as customer_email
FROM orders o
JOIN talent_profiles tp ON tp.id = o.talent_id
LEFT JOIN users u ON u.id = tp.user_id
LEFT JOIN users cu ON cu.id = o.user_id
WHERE tp.username = 'joshfirestine'
   OR LOWER(COALESCE(u.full_name, tp.temp_full_name)) LIKE '%josh%firestine%'
ORDER BY o.created_at DESC;

-- Also check what Josh's actual pricing is set to
SELECT 
  username,
  pricing,
  COALESCE(u.full_name, temp_full_name) as full_name
FROM talent_profiles tp
LEFT JOIN users u ON u.id = tp.user_id
WHERE username = 'joshfirestine'
   OR LOWER(COALESCE(u.full_name, temp_full_name)) LIKE '%josh%firestine%';


-- Search for Mark Walker's Fortis transaction in existing orders
-- This will help us find the transaction ID if it exists anywhere

-- 1. Check if transaction ID appears in ANY order (even if not Mark's)
SELECT 
  'Searching all payment_transaction_id for clues' as search_type;

-- Search for recent transactions created around the same time Mark tried
SELECT 
  o.id,
  o.user_id,
  o.talent_id,
  o.payment_transaction_id,
  o.amount / 100.0 as amount_dollars,
  o.status,
  o.created_at,
  u.email,
  t.temp_full_name as talent_name
FROM orders o
LEFT JOIN public.users u ON o.user_id = u.id
LEFT JOIN talent_profiles t ON o.talent_id = t.id
WHERE o.created_at BETWEEN '2025-11-27 00:00:00' AND '2025-11-29 00:00:00'
ORDER BY o.created_at DESC;

-- Check for any failed webhook or notification logs that might indicate timing
SELECT 
  'Next step: Get Fortis Transaction ID from dashboard' as action_needed,
  'Then we can manually create the order' as next_action;


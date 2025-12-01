-- Check the order by radarman@gmail.com and see if recipient_name was entered

SELECT 
  o.id as order_id,
  o.created_at,
  o.status,
  u.full_name as customer_name,
  u.email as customer_email,
  tp_user.full_name as talent_name,
  o.recipient_name as "Who is it for?",
  o.request_details as message,
  o.amount / 100.0 as amount_dollars,
  o.payment_transaction_id
FROM orders o
JOIN users u ON o.user_id = u.id
JOIN talent_profiles tp ON o.talent_id = tp.id
JOIN users tp_user ON tp.user_id = tp_user.id
WHERE u.email = 'radarman@gmail.com'
ORDER BY o.created_at DESC;


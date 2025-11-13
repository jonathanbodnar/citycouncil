-- Check if Shawn's orders have passed their due dates

SELECT 
  o.id,
  o.status,
  o.created_at,
  o.updated_at,
  tp.fulfillment_time_hours,
  o.created_at + (tp.fulfillment_time_hours || ' hours')::interval as due_date,
  NOW() as current_time,
  CASE 
    WHEN NOW() > o.created_at + (tp.fulfillment_time_hours || ' hours')::interval 
    THEN '⚠️ PAST DUE'
    ELSE '✅ Still in time'
  END as due_status,
  EXTRACT(EPOCH FROM (NOW() - (o.created_at + (tp.fulfillment_time_hours || ' hours')::interval))) / 3600 as hours_overdue
FROM orders o
JOIN talent_profiles tp ON tp.id = o.talent_id
WHERE o.id IN (
  '8e01dd16-90df-44c7-a440-1919ce26acf4',
  '30ffb97f-f1e3-417a-9a7d-285ea69b019c'
)
ORDER BY o.created_at DESC;


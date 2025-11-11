-- Remove the OLD demo order trigger that still has the ON CONFLICT bug

-- Drop the old trigger
DROP TRIGGER IF EXISTS auto_create_demo_order ON talent_profiles;

-- Drop the old function
DROP FUNCTION IF EXISTS trigger_create_demo_order();

-- Verify only the NEW trigger remains
SELECT 
  trigger_name,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'talent_profiles'
  AND trigger_name LIKE '%demo%';

SELECT '✅ Old demo order trigger removed! Only on_talent_onboarded should remain.' as result;


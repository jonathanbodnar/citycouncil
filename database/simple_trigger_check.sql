-- Simple check: Does the trigger exist and is it enabled?

-- 1. Check trigger
SELECT 
  tgname as trigger_name,
  tgenabled as enabled,
  tgrelid::regclass as table_name
FROM pg_trigger
WHERE tgname = 'on_talent_onboarded';

-- 2. Check function
SELECT 
  proname as function_name,
  'EXISTS' as status
FROM pg_proc
WHERE proname = 'create_demo_order_for_talent';

-- 3. Check testingauto conditions
SELECT 
  tp.full_name,
  tp.onboarding_completed,
  tp.id = ANY(ARRAY[
    (SELECT id FROM talent_profiles WHERE full_name = 'Nick Di Palo'),
    (SELECT id FROM talent_profiles WHERE full_name = 'Shawn Farash'),
    (SELECT id FROM talent_profiles WHERE full_name = 'Gerald Morgan')
  ]) as is_excluded,
  EXISTS (
    SELECT 1 FROM orders 
    WHERE talent_id = tp.id 
    AND order_type = 'demo'
  ) as already_has_demo
FROM talent_profiles tp
WHERE tp.full_name ILIKE '%testingauto%';

-- 4. Count demo orders for testingauto
SELECT COUNT(*) as demo_order_count
FROM orders o
JOIN talent_profiles tp ON tp.id = o.talent_id
WHERE tp.full_name ILIKE '%testingauto%'
AND o.order_type = 'demo';

-- 5. If trigger exists, manually call it
DO $$
DECLARE
  rec RECORD;
BEGIN
  -- Get testingauto record
  SELECT * INTO rec
  FROM talent_profiles
  WHERE full_name ILIKE '%testingauto%'
  LIMIT 1;
  
  IF rec.id IS NOT NULL THEN
    RAISE NOTICE '=== MANUAL TRIGGER TEST ===';
    RAISE NOTICE 'Talent: %, ID: %', rec.full_name, rec.id;
    RAISE NOTICE 'Current onboarding_completed: %', rec.onboarding_completed;
    
    -- Reset to false
    UPDATE talent_profiles SET onboarding_completed = false WHERE id = rec.id;
    RAISE NOTICE 'Set to false';
    
    -- Set to true (should trigger demo order creation)
    UPDATE talent_profiles SET onboarding_completed = true WHERE id = rec.id;
    RAISE NOTICE 'Set to true - trigger should have fired';
    
    -- Check if demo order was created
    IF EXISTS (SELECT 1 FROM orders WHERE talent_id = rec.id AND order_type = 'demo') THEN
      RAISE NOTICE '✅ SUCCESS: Demo order was created!';
    ELSE
      RAISE NOTICE '❌ FAILED: Demo order was NOT created';
      RAISE NOTICE 'Checking why...';
      
      -- Check if trigger exists
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_talent_onboarded') THEN
        RAISE NOTICE '❌ Trigger does not exist!';
      END IF;
      
      -- Check if function exists
      IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_demo_order_for_talent') THEN
        RAISE NOTICE '❌ Function does not exist!';
      END IF;
    END IF;
  END IF;
END $$;

-- 6. Show final result
SELECT 
  'FINAL CHECK' as status,
  o.id,
  o.order_type,
  o.amount,
  o.request_details,
  o.created_at,
  tp.full_name as talent_name
FROM orders o
JOIN talent_profiles tp ON tp.id = o.talent_id
WHERE tp.full_name ILIKE '%testingauto%'
ORDER BY o.created_at DESC;


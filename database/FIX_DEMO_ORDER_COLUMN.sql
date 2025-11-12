-- Fix demo order trigger - remove recipient_name reference
-- The column doesn't exist in the orders table

DROP FUNCTION IF EXISTS create_demo_order_for_talent() CASCADE;

CREATE OR REPLACE FUNCTION create_demo_order_for_talent()
RETURNS TRIGGER AS $$
DECLARE
  demo_user_id UUID;
  demo_request TEXT;
  demo_name TEXT;
  demo_email TEXT;
  created_order_id UUID;
  talent_phone TEXT;
  sms_is_enabled BOOLEAN;
  excluded_talent_names TEXT[] := ARRAY['Nick Di Palo', 'Shawn Farash', 'Gerald Morgan'];
BEGIN
  -- Only create demo order if onboarding just completed and talent not excluded
  IF NEW.onboarding_completed = true 
     AND (OLD.onboarding_completed IS NULL OR OLD.onboarding_completed = false)
     AND NOT (NEW.full_name = ANY(excluded_talent_names))
     AND NOT EXISTS (SELECT 1 FROM orders WHERE talent_id = NEW.id AND order_type = 'demo')
  THEN
    
    demo_request := 'Wish my mother, Linda a happy 90th birthday! Make it heartfelt and mention how proud we are of her accomplishments.';
    demo_name := 'Michael Thompson';
    demo_email := 'demo_customer_' || NEW.id || '@shoutout.us';
    
    -- Get or create demo user
    SELECT id INTO demo_user_id FROM users WHERE email = demo_email LIMIT 1;
    
    IF demo_user_id IS NULL THEN
      demo_user_id := gen_random_uuid();
      INSERT INTO users (id, email, full_name, user_type, created_at, updated_at)
      VALUES (demo_user_id, demo_email, demo_name, 'user', NOW(), NOW());
    END IF;

    -- Create demo order WITHOUT recipient_name
    INSERT INTO orders (
      user_id, talent_id, request_details, amount, admin_fee,
      payment_transaction_id, status, order_type, is_corporate,
      fulfillment_deadline, approval_status, created_at, updated_at
    ) VALUES (
      demo_user_id, NEW.id, demo_request, 1, 0,
      'DEMO_ORDER_' || NEW.id || '_' || EXTRACT(EPOCH FROM NOW())::TEXT,
      'pending', 'demo', false, NOW() + INTERVAL '72 hours',
      'pending', NOW(), NOW()
    ) RETURNING id INTO created_order_id;
    
    -- Create notification
    INSERT INTO notifications (user_id, type, title, message, order_id, is_read, created_at)
    VALUES (
      NEW.user_id, 'order_placed', 'Demo Order Received! 🎬',
      'Complete your first demo order to get familiar with the fulfillment process.',
      created_order_id, false, NOW()
    );
    
    RAISE NOTICE 'Demo order created for talent % (ID: %)', NEW.full_name, NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_talent_onboarded ON public.talent_profiles;
CREATE TRIGGER on_talent_onboarded
  AFTER UPDATE ON public.talent_profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_demo_order_for_talent();

SELECT 'Demo order trigger fixed - recipient_name removed' AS status;


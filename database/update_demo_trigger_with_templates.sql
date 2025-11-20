-- Update the demo order creation trigger to use unique templates per talent

DROP FUNCTION IF EXISTS create_demo_order_for_talent() CASCADE;

CREATE OR REPLACE FUNCTION create_demo_order_for_talent()
RETURNS TRIGGER AS $$
DECLARE
  demo_user_id UUID;
  demo_template_id UUID;
  demo_request TEXT;
  demo_name TEXT;
  demo_email TEXT;
  created_order_id UUID;
  talent_phone TEXT;
  sms_is_enabled BOOLEAN;
  profile_url TEXT;
  welcome_message TEXT;
  excluded_talent_ids UUID[] := ARRAY[
    (SELECT id FROM talent_profiles WHERE full_name = 'Nick Di Palo'),
    (SELECT id FROM talent_profiles WHERE full_name = 'Shawn Farash'),
    (SELECT id FROM talent_profiles WHERE full_name = 'Gerald Morgan')
  ];
BEGIN
  -- Only trigger when onboarding is completed
  IF NEW.onboarding_completed = true 
     AND (OLD.onboarding_completed IS NULL OR OLD.onboarding_completed = false) THEN
    
    -- Get phone and check if SMS is enabled
    SELECT u.phone INTO talent_phone
    FROM users u
    WHERE u.id = NEW.user_id;
    
    sms_is_enabled := Deno.env.get('SMS_ENABLED') = 'true';
    
    -- Send welcome SMS if phone exists and SMS is enabled
    IF talent_phone IS NOT NULL AND talent_phone != '' AND sms_is_enabled THEN
      BEGIN
        profile_url := 'https://shoutout.us/' || NEW.username;
        welcome_message := 'Welcome to ShoutOut, ' || COALESCE(NEW.full_name, NEW.temp_full_name) || '! 🎉 Your profile is live at ' || profile_url || '. You''ll receive your first order request soon. Reply anytime for support!';
        
        PERFORM supabase.functions.invoke(
          'send-sms',
          json_build_object(
            'to', talent_phone,
            'message', welcome_message
          )::jsonb
        );
        
        RAISE NOTICE '📱 Welcome SMS sent to talent: %', talent_phone;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE '❌ Failed to send welcome SMS: %', SQLERRM;
      END;
    ELSE
      RAISE NOTICE '⚠️ No phone number or SMS disabled, welcome SMS not sent';
    END IF;

    -- Only create demo order if talent is not in exclusion list and no demo order exists
    IF NOT (NEW.id = ANY(excluded_talent_ids))
       AND NOT EXISTS (
         SELECT 1 FROM orders 
         WHERE talent_id = NEW.id 
         AND order_type = 'demo'
       ) THEN
      
      -- Assign a unique demo template for this talent
      demo_template_id := assign_demo_template_to_talent(NEW.id);
      
      -- Get the template text
      SELECT request_text INTO demo_request
      FROM demo_video_templates
      WHERE id = demo_template_id;
      
      -- Hardcoded demo customer data
      demo_name := 'Michael Thompson';
      demo_email := 'demo_customer_' || NEW.id || '@shoutout.us';
      
      -- Find or create demo customer user
      SELECT id INTO demo_user_id
      FROM users
      WHERE email = demo_email;
      
      IF demo_user_id IS NULL THEN
        demo_user_id := gen_random_uuid();
        INSERT INTO users (
          id, email, full_name, user_type, created_at, updated_at
        )
        VALUES (
          demo_user_id, demo_email, demo_name, 'user', NOW(), NOW()
        );
        RAISE NOTICE '👤 Created demo customer user: %', demo_name;
      END IF;

      -- Create demo order with unique template
      INSERT INTO orders (
        id,
        user_id,
        talent_id,
        request_details,
        amount,
        admin_fee,
        charity_amount,
        payment_transaction_id,
        status,
        order_type,
        demo_template_id,
        is_corporate,
        is_corporate_order,
        approval_status,
        fulfillment_deadline,
        created_at,
        updated_at
      ) VALUES (
        gen_random_uuid(),
        demo_user_id,
        NEW.id,
        demo_request,  -- Unique request from template
        100,  -- $1.00 in cents
        0,
        0,
        'demo-order-' || NEW.id,
        'pending',
        'demo',
        demo_template_id,  -- Track which template was used
        false,
        false,
        'approved',
        NOW() + INTERVAL '7 days',
        NOW(),
        NOW()
      )
      RETURNING id INTO created_order_id;
      
      RAISE NOTICE '🎯 Demo order created with unique template % for talent %', 
        demo_template_id, NEW.id;
      
      -- Send SMS notification about the demo order
      IF talent_phone IS NOT NULL AND talent_phone != '' AND sms_is_enabled THEN
        BEGIN
          PERFORM supabase.functions.invoke(
            'send-sms',
            json_build_object(
              'to', talent_phone,
              'message', 'You have a new order! Check your dashboard to record your demo video. This helps potential customers see your style!'
            )::jsonb
          );
          RAISE NOTICE '📱 Demo order SMS sent to talent';
        EXCEPTION
          WHEN OTHERS THEN
            RAISE NOTICE '❌ Failed to send demo order SMS: %', SQLERRM;
        END;
      END IF;
      
    ELSE
      IF NEW.id = ANY(excluded_talent_ids) THEN
        RAISE NOTICE '⏭️ Talent % excluded from demo orders', NEW.id;
      ELSE
        RAISE NOTICE '⏭️ Demo order already exists for talent %', NEW.id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in create_demo_order_for_talent: % %', SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_talent_onboarded ON talent_profiles;

CREATE TRIGGER on_talent_onboarded
  AFTER UPDATE ON talent_profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_demo_order_for_talent();

SELECT '✅ Demo order trigger updated to use unique templates per talent!' AS status;


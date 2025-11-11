-- Create system for automatic demo order creation after onboarding

-- 1. Add demo_order_created flag to talent_profiles
ALTER TABLE talent_profiles 
ADD COLUMN IF NOT EXISTS demo_order_created BOOLEAN DEFAULT FALSE;

-- 2. Create function to generate random demo order request
CREATE OR REPLACE FUNCTION generate_demo_order_request() 
RETURNS TEXT AS $$
DECLARE
  requests TEXT[] := ARRAY[
    'Wish my mother, Linda a happy 90th birthday!',
    'What''s the best life advice for a 22 year old who doesn''t want to go to college?',
    'Congratulate my son, Michael on his graduation!',
    'Give my wife, Sarah some motivation for her new business venture',
    'Wish my daughter, Emily good luck on her first day of college',
    'Share your thoughts on following your passion vs playing it safe',
    'Give some words of encouragement to my friend, David who just lost his job',
    'Wish my husband, Robert a happy anniversary!',
    'What advice would you give to someone starting their first business?',
    'Congratulate my friend, Jessica on her new baby girl!',
    'Give my nephew, Tyler some motivation for his basketball tryouts',
    'Wish my sister, Amanda a speedy recovery from surgery'
  ];
BEGIN
  RETURN requests[floor(random() * array_length(requests, 1) + 1)];
END;
$$ LANGUAGE plpgsql;

-- 3. Create function to generate random demo customer name
CREATE OR REPLACE FUNCTION generate_demo_customer_name() 
RETURNS TEXT AS $$
DECLARE
  first_names TEXT[] := ARRAY['John', 'Sarah', 'Michael', 'Jennifer', 'David', 'Emily', 'Robert', 'Amanda', 'James', 'Lisa'];
  last_names TEXT[] := ARRAY['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
BEGIN
  RETURN first_names[floor(random() * array_length(first_names, 1) + 1)] || ' ' || 
         last_names[floor(random() * array_length(last_names, 1) + 1)];
END;
$$ LANGUAGE plpgsql;

-- 4. Create function to create demo order for a talent
CREATE OR REPLACE FUNCTION create_demo_order_for_talent(talent_profile_id UUID)
RETURNS UUID AS $$
DECLARE
  demo_user_id UUID;
  demo_order_id UUID;
  talent_pricing DECIMAL;
  talent_username VARCHAR;
  talent_user_id UUID;
  customer_name TEXT;
  order_request TEXT;
BEGIN
  -- Get talent details
  SELECT pricing, username, user_id INTO talent_pricing, talent_username, talent_user_id
  FROM talent_profiles
  WHERE id = talent_profile_id;

  -- Generate demo customer details
  customer_name := generate_demo_customer_name();
  order_request := generate_demo_order_request();

  -- Create demo user if not exists (using a fixed demo email pattern)
  INSERT INTO users (id, email, full_name, user_type, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    'demo-order-' || talent_username || '@shoutout.internal',
    customer_name,
    'user',
    NOW(),
    NOW()
  )
  ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
  RETURNING id INTO demo_user_id;

  -- Create demo order
  INSERT INTO orders (
    id,
    user_id,
    talent_id,
    amount,
    status,
    request_details,
    fulfillment_time_hours,
    is_corporate,
    transaction_id,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    demo_user_id,
    talent_profile_id,
    talent_pricing * 100, -- Convert to cents
    'pending',
    order_request,
    48,
    FALSE,
    'DEMO-' || upper(substring(md5(random()::text) from 1 for 12)),
    NOW(),
    NOW()
  )
  RETURNING id INTO demo_order_id;

  -- Create notification for talent
  INSERT INTO notifications (
    id,
    user_id,
    type,
    title,
    message,
    link,
    is_read,
    created_at
  ) VALUES (
    gen_random_uuid(),
    talent_user_id,
    'order_received',
    'Demo Order - Complete to Activate Live Orders',
    'Hey ' || split_part((SELECT full_name FROM users WHERE id = talent_user_id), ' ', 1) || 
    ', here''s your demo order, please fulfill it to activate live orders!',
    '/dashboard?tab=orders&order=' || demo_order_id,
    FALSE,
    NOW()
  );

  -- Mark demo order as created for this talent
  UPDATE talent_profiles 
  SET demo_order_created = TRUE 
  WHERE id = talent_profile_id;

  RETURN demo_order_id;
END;
$$ LANGUAGE plpgsql;

-- 5. Create trigger to auto-create demo order when onboarding completes
CREATE OR REPLACE FUNCTION trigger_create_demo_order()
RETURNS TRIGGER AS $$
DECLARE
  first_name TEXT;
BEGIN
  -- Only create demo order if:
  -- 1. Onboarding was just completed (changed to true)
  -- 2. Demo order hasn't been created yet
  -- 3. Not one of the excluded talents (Nick Di Palo, Shawn Farash, Gerald Morgan)
  IF NEW.onboarding_completed = TRUE 
     AND (OLD.onboarding_completed = FALSE OR OLD.onboarding_completed IS NULL)
     AND NEW.demo_order_created = FALSE
     AND NEW.full_name NOT IN ('Nick Di Palo', 'Shawn Farash', 'Gerald Morgan')
  THEN
    PERFORM create_demo_order_for_talent(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS auto_create_demo_order ON talent_profiles;

-- Create trigger
CREATE TRIGGER auto_create_demo_order
  AFTER UPDATE ON talent_profiles
  FOR EACH ROW
  EXECUTE FUNCTION trigger_create_demo_order();

-- 6. Backfill demo orders for existing onboarded talents (excluding the 3 mentioned)
-- Run this manually after reviewing:
/*
DO $$
DECLARE
  talent_record RECORD;
BEGIN
  FOR talent_record IN 
    SELECT id, full_name 
    FROM talent_profiles 
    WHERE onboarding_completed = TRUE 
    AND demo_order_created = FALSE
    AND full_name NOT IN ('Nick Di Palo', 'Shawn Farash', 'Gerald Morgan')
  LOOP
    PERFORM create_demo_order_for_talent(talent_record.id);
    RAISE NOTICE 'Created demo order for: %', talent_record.full_name;
  END LOOP;
END $$;
*/

-- Comment for documentation
COMMENT ON COLUMN talent_profiles.demo_order_created IS 'Whether a demo order has been automatically created for this talent';
COMMENT ON FUNCTION create_demo_order_for_talent(UUID) IS 'Creates a demo order for a talent with random customer name and request';
COMMENT ON FUNCTION generate_demo_order_request() IS 'Generates a random realistic demo order request';
COMMENT ON FUNCTION generate_demo_customer_name() IS 'Generates a random demo customer name';


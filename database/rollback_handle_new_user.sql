-- Rollback to simpler handle_new_user trigger
-- The issue is likely the ON CONFLICT clause or the phone field

-- First, let's check what columns actually exist in the users table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'users'
ORDER BY ordinal_position;

-- Simple, working version of handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into public.users table with minimal fields
  INSERT INTO public.users (
    id, 
    email, 
    full_name, 
    user_type, 
    created_at, 
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'user_type', 'user'),
    NOW(),
    NOW()
  );
    
  -- Create notification settings for the new user
  INSERT INTO public.notification_settings (
    user_id,
    notification_type,
    email_enabled,
    sms_enabled,
    push_enabled
  )
  VALUES
    (NEW.id, 'order_placed', true, true, true),
    (NEW.id, 'order_completed', true, true, true),
    (NEW.id, 'order_denied', true, true, true),
    (NEW.id, 'video_approved', true, true, true),
    (NEW.id, 'video_rejected', true, true, true),
    (NEW.id, 'refund_processed', true, true, true),
    (NEW.id, 'payment_received', true, true, true),
    (NEW.id, 'order_expiring', true, true, true)
  ON CONFLICT (user_id, notification_type) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify trigger exists
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';


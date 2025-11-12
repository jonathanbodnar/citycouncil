-- Fix foreign key constraint issue for users table during onboarding
-- Issue: "insert or update on table "users" violates foreign key constraint "users_id_fkey""

-- 1. Check what foreign key constraints exist on users table
SELECT
  conname AS constraint_name,
  contype AS constraint_type,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.users'::regclass
ORDER BY conname;

-- 2. The issue is likely that users.id is trying to reference auth.users.id
-- but the auth.users record doesn't exist yet when the trigger fires

-- 3. Check if the foreign key constraint exists and is causing issues
DO $$
BEGIN
  -- Drop the problematic foreign key if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'users_id_fkey' 
    AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users DROP CONSTRAINT users_id_fkey;
    RAISE NOTICE 'Dropped users_id_fkey constraint';
  END IF;
END $$;

-- 4. Recreate it properly with ON DELETE CASCADE
-- This ensures that if auth.users is deleted, public.users is also deleted
ALTER TABLE public.users
  ADD CONSTRAINT users_id_fkey 
  FOREIGN KEY (id) 
  REFERENCES auth.users(id) 
  ON DELETE CASCADE
  DEFERRABLE INITIALLY DEFERRED;

-- 5. Update the handle_new_user trigger to be more robust
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into public.users table
  -- This happens AFTER the auth.users record is created
  INSERT INTO public.users (
    id, 
    email, 
    full_name, 
    phone,
    user_type, 
    created_at, 
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.phone, ''),
    COALESCE(NEW.raw_user_meta_data->>'user_type', 'user'),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.users.full_name),
    phone = COALESCE(EXCLUDED.phone, public.users.phone),
    updated_at = NOW();
    
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

-- 6. Ensure the trigger is set correctly
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 7. Verify the constraint was updated
SELECT
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS definition,
  'Updated successfully' as status
FROM pg_constraint
WHERE conname = 'users_id_fkey'
  AND conrelid = 'public.users'::regclass;


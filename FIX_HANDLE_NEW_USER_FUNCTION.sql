-- Fix the handle_new_user function to work with talent onboarding
-- The issue: it was setting user_type = 'user' always, and using UPSERT

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Only create user record if it doesn't exist
  -- This allows our frontend to create it first with correct user_type
  INSERT INTO public.users (id, email, full_name, avatar_url, user_type, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    COALESCE(NEW.raw_user_meta_data->>'user_type', 'user'), -- Use metadata if provided
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING; -- Don't overwrite if already exists
  
  RETURN NEW;
END;
$function$;


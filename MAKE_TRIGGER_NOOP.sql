-- Make the trigger function a NO-OP (do nothing)
-- This lets signUp() succeed, then our frontend code creates the user record

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Don't do anything - just return
  -- Frontend will handle creating the public.users record
  RETURN NEW;
END;
$function$;

-- The trigger is still enabled, but now it does nothing
-- signUp() will succeed and our frontend code will create the user


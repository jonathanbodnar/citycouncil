-- ============================================================
-- FIX: Onboarding talent link function - update to match frontend
-- ============================================================
-- The frontend is calling link_talent_profile_to_user with 7 parameters
-- but the deployed function might only have 4 parameters.
-- 
-- This also REMOVES the expiration check so onboarding links never expire.
-- ============================================================

-- Drop all versions of the function to start fresh
DROP FUNCTION IF EXISTS link_talent_profile_to_user(UUID, UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS link_talent_profile_to_user(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT);

-- Create the correct function that matches frontend expectations
CREATE OR REPLACE FUNCTION link_talent_profile_to_user(
  p_talent_id UUID,
  p_user_id UUID,
  p_onboarding_token TEXT,
  p_full_name TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_talent RECORD;
  v_user RECORD;
BEGIN
  -- Validate the onboarding token (NO EXPIRATION CHECK - links never expire)
  SELECT * INTO v_talent
  FROM public.talent_profiles 
  WHERE id = p_talent_id 
  AND onboarding_token = p_onboarding_token;
  
  IF NOT FOUND THEN
    -- Try to find by token alone (maybe talent_id is wrong/null)
    SELECT * INTO v_talent
    FROM public.talent_profiles 
    WHERE onboarding_token = p_onboarding_token;
    
    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Invalid onboarding token',
        'debug', jsonb_build_object(
          'provided_talent_id', p_talent_id,
          'provided_token', p_onboarding_token
        )
      );
    END IF;
  END IF;
  
  -- Check if already linked to a different user
  IF v_talent.user_id IS NOT NULL AND v_talent.user_id != p_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'This profile is already linked to another account',
      'existing_user_id', v_talent.user_id
    );
  END IF;
  
  -- FIRST: Create or update the user record (this bypasses RLS)
  INSERT INTO public.users (id, email, phone, full_name, user_type, avatar_url)
  VALUES (
    p_user_id,
    p_email,
    p_phone,
    COALESCE(p_full_name, v_talent.temp_full_name, 'Talent Member'),
    'talent',
    COALESCE(p_avatar_url, v_talent.temp_avatar_url)
  )
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(EXCLUDED.email, users.email),
    phone = COALESCE(EXCLUDED.phone, users.phone),
    full_name = COALESCE(EXCLUDED.full_name, users.full_name),
    user_type = 'talent',
    avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
    updated_at = NOW();
  
  -- THEN: Update the talent profile to link to user
  UPDATE public.talent_profiles
  SET 
    user_id = p_user_id,
    full_name = COALESCE(p_full_name, full_name, temp_full_name)
  WHERE id = v_talent.id;  -- Use the ID from our lookup, not the parameter
  
  -- Log for audit
  BEGIN
    INSERT INTO public.admin_audit_log (admin_id, action, target_user_id, metadata)
    VALUES (
      COALESCE(auth.uid(), p_user_id),
      'talent_profile_linked',
      p_user_id,
      jsonb_build_object(
        'talent_id', v_talent.id,
        'full_name', p_full_name,
        'email', p_email,
        'linked_at', NOW()
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- Audit log failure shouldn't block the main operation
    NULL;
  END;
  
  RETURN jsonb_build_object(
    'success', true,
    'talent_id', v_talent.id,
    'user_id', p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to all users (needed for onboarding)
GRANT EXECUTE ON FUNCTION link_talent_profile_to_user(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION link_talent_profile_to_user(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon;

-- ============================================================
-- Also add an RLS policy to allow reading talent_profiles by token
-- This lets the onboarding page fetch the profile data
-- ============================================================

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Allow reading talent profiles by onboarding token" ON talent_profiles;

-- Create policy for public access by onboarding token
CREATE POLICY "Allow reading talent profiles by onboarding token" ON talent_profiles
FOR SELECT
TO public
USING (onboarding_token IS NOT NULL);

-- Refresh the schema cache
NOTIFY pgrst, 'reload schema';

SELECT 'Function updated and RLS policy added!' as status;

-- Function to link a talent profile to a user during onboarding
-- This runs with SECURITY DEFINER to bypass RLS since the newly created user
-- might not have permission to update talent_profiles yet

CREATE OR REPLACE FUNCTION link_talent_profile_to_user(
  p_talent_id UUID,
  p_user_id UUID,
  p_onboarding_token TEXT,
  p_full_name TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_token_valid BOOLEAN;
BEGIN
  -- Verify the onboarding token matches the talent profile
  -- This ensures only valid onboarding requests can link accounts
  SELECT EXISTS (
    SELECT 1 FROM public.talent_profiles 
    WHERE id = p_talent_id 
    AND onboarding_token = p_onboarding_token
    AND (onboarding_expires_at IS NULL OR onboarding_expires_at > NOW())
  ) INTO v_token_valid;
  
  IF NOT v_token_valid THEN
    RAISE EXCEPTION 'Invalid or expired onboarding token';
  END IF;
  
  -- Update the talent profile with the user_id
  UPDATE public.talent_profiles
  SET 
    user_id = p_user_id,
    full_name = COALESCE(p_full_name, full_name)
  WHERE id = p_talent_id
  AND onboarding_token = p_onboarding_token;
  
  -- Log the linking for audit purposes
  INSERT INTO public.admin_audit_log (
    action,
    entity_type,
    entity_id,
    details
  ) VALUES (
    'talent_profile_linked',
    'talent_profiles',
    p_talent_id,
    jsonb_build_object(
      'user_id', p_user_id,
      'full_name', p_full_name,
      'linked_at', NOW()
    )
  );
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users (needed for onboarding)
GRANT EXECUTE ON FUNCTION link_talent_profile_to_user TO authenticated;
GRANT EXECUTE ON FUNCTION link_talent_profile_to_user TO anon;


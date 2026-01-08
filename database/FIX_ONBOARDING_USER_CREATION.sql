-- ============================================================
-- FIX: Update link_talent_profile_to_user to also create user record
-- ============================================================
-- The issue: RLS blocks user creation from frontend during onboarding
-- The fix: Have the SECURITY DEFINER function create/upsert the user first
-- ============================================================

DROP FUNCTION IF EXISTS link_talent_profile_to_user(UUID, UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS link_talent_profile_to_user(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT);

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
  -- Validate the onboarding token
  SELECT * INTO v_talent
  FROM public.talent_profiles 
  WHERE id = p_talent_id 
  AND onboarding_token = p_onboarding_token
  AND (onboarding_expires_at IS NULL OR onboarding_expires_at > NOW());
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid or expired onboarding token'
    );
  END IF;
  
  -- Check if already linked to a different user
  IF v_talent.user_id IS NOT NULL AND v_talent.user_id != p_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'This profile is already linked to another account'
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
  WHERE id = p_talent_id;
  
  -- Log for audit
  INSERT INTO public.admin_audit_log (admin_id, action, target_user_id, metadata)
  VALUES (
    COALESCE(auth.uid(), p_user_id),
    'talent_profile_linked',
    p_user_id,
    jsonb_build_object(
      'talent_id', p_talent_id,
      'full_name', p_full_name,
      'email', p_email,
      'linked_at', NOW()
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'talent_id', p_talent_id,
    'user_id', p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION link_talent_profile_to_user TO authenticated;
GRANT EXECUTE ON FUNCTION link_talent_profile_to_user TO anon;

-- Verify
SELECT 'Function updated successfully!' as status;


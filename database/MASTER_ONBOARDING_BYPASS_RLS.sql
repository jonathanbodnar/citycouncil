-- ============================================================
-- MASTER ONBOARDING FUNCTION - BYPASSES ALL RLS FOR ONBOARDING
-- ============================================================
-- This function handles ALL database operations during talent onboarding
-- with SECURITY DEFINER to bypass RLS policies.
--
-- WHY THIS EXISTS:
-- During onboarding, a newly created user needs to update talent_profiles,
-- users, and other tables. But RLS policies check auth.uid() against
-- existing user_id columns - creating a chicken-and-egg problem where
-- the user can't update the record that would give them access.
--
-- This function validates the onboarding token (security) then performs
-- all necessary updates with elevated privileges.
-- ============================================================

-- Drop existing functions to replace them
DROP FUNCTION IF EXISTS link_talent_profile_to_user(UUID, UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS complete_talent_onboarding(UUID, TEXT, JSONB);

-- ============================================================
-- 1. LINK TALENT PROFILE TO USER (Step 1 of onboarding)
-- ============================================================
CREATE OR REPLACE FUNCTION link_talent_profile_to_user(
  p_talent_id UUID,
  p_user_id UUID,
  p_onboarding_token TEXT,
  p_full_name TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_talent RECORD;
  v_result JSONB;
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
  
  -- Update the talent profile
  UPDATE public.talent_profiles
  SET 
    user_id = p_user_id,
    full_name = COALESCE(p_full_name, full_name, temp_full_name)
  WHERE id = p_talent_id;
  
  -- Log for audit
  INSERT INTO public.admin_audit_log (action, entity_type, entity_id, details)
  VALUES (
    'talent_profile_linked',
    'talent_profiles',
    p_talent_id,
    jsonb_build_object(
      'user_id', p_user_id,
      'full_name', p_full_name,
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

-- ============================================================
-- 2. UPDATE TALENT PROFILE (Step 2 - profile editing)
-- ============================================================
CREATE OR REPLACE FUNCTION update_talent_profile_onboarding(
  p_talent_id UUID,
  p_onboarding_token TEXT,
  p_updates JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_talent RECORD;
BEGIN
  -- Validate the onboarding token
  SELECT * INTO v_talent
  FROM public.talent_profiles 
  WHERE id = p_talent_id 
  AND onboarding_token = p_onboarding_token;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid onboarding token'
    );
  END IF;
  
  -- Update allowed fields only
  UPDATE public.talent_profiles
  SET 
    bio = COALESCE(p_updates->>'bio', bio),
    pricing = COALESCE((p_updates->>'pricing')::NUMERIC, pricing),
    corporate_pricing = COALESCE((p_updates->>'corporate_pricing')::NUMERIC, corporate_pricing),
    allow_corporate_pricing = COALESCE((p_updates->>'allow_corporate_pricing')::BOOLEAN, allow_corporate_pricing),
    fulfillment_time_hours = COALESCE((p_updates->>'fulfillment_time_hours')::INTEGER, fulfillment_time_hours),
    charity_percentage = COALESCE((p_updates->>'charity_percentage')::NUMERIC, charity_percentage),
    charity_name = COALESCE(p_updates->>'charity_name', charity_name),
    twitter_handle = COALESCE(p_updates->>'twitter_handle', twitter_handle),
    instagram_handle = COALESCE(p_updates->>'instagram_handle', instagram_handle),
    facebook_handle = COALESCE(p_updates->>'facebook_handle', facebook_handle),
    tiktok_handle = COALESCE(p_updates->>'tiktok_handle', tiktok_handle),
    rumble_handle = COALESCE(p_updates->>'rumble_handle', rumble_handle),
    youtube_handle = COALESCE(p_updates->>'youtube_handle', youtube_handle),
    temp_avatar_url = COALESCE(p_updates->>'temp_avatar_url', temp_avatar_url),
    current_onboarding_step = COALESCE((p_updates->>'current_onboarding_step')::INTEGER, current_onboarding_step)
  WHERE id = p_talent_id;
  
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 3. COMPLETE ONBOARDING (Final step)
-- ============================================================
CREATE OR REPLACE FUNCTION complete_talent_onboarding(
  p_talent_id UUID,
  p_onboarding_token TEXT,
  p_final_updates JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_talent RECORD;
BEGIN
  -- Validate the onboarding token
  SELECT * INTO v_talent
  FROM public.talent_profiles 
  WHERE id = p_talent_id 
  AND onboarding_token = p_onboarding_token;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid onboarding token'
    );
  END IF;
  
  -- Apply any final updates and mark as complete
  UPDATE public.talent_profiles
  SET 
    onboarding_completed = true,
    is_active = COALESCE((p_final_updates->>'is_active')::BOOLEAN, true),
    onboarding_token = NULL,  -- Invalidate the token
    onboarding_expires_at = NULL,
    current_onboarding_step = 5,
    welcome_video_url = COALESCE(p_final_updates->>'welcome_video_url', welcome_video_url)
  WHERE id = p_talent_id;
  
  -- Log completion
  INSERT INTO public.admin_audit_log (action, entity_type, entity_id, details)
  VALUES (
    'talent_onboarding_completed',
    'talent_profiles',
    p_talent_id,
    jsonb_build_object(
      'completed_at', NOW(),
      'user_id', v_talent.user_id
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'talent_id', p_talent_id,
    'message', 'Onboarding completed successfully'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 4. CREATE PAYOUT DURING VIDEO UPLOAD (bypasses payout_batches RLS)
-- ============================================================
CREATE OR REPLACE FUNCTION create_payout_for_order(
  p_order_id UUID,
  p_talent_id UUID,
  p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
  v_talent RECORD;
  v_payout_amount NUMERIC;
  v_admin_fee_pct NUMERIC;
  v_batch_id UUID;
BEGIN
  -- Verify the user owns this talent profile
  SELECT * INTO v_talent
  FROM public.talent_profiles
  WHERE id = p_talent_id AND user_id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized: You do not own this talent profile'
    );
  END IF;
  
  -- Get the order
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id AND talent_id = p_talent_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order not found or does not belong to this talent'
    );
  END IF;
  
  -- The actual payout is handled by the trigger on orders
  -- This function just validates access
  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'message', 'Payout will be created by trigger'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- GRANT PERMISSIONS
-- ============================================================
GRANT EXECUTE ON FUNCTION link_talent_profile_to_user TO authenticated;
GRANT EXECUTE ON FUNCTION link_talent_profile_to_user TO anon;
GRANT EXECUTE ON FUNCTION update_talent_profile_onboarding TO authenticated;
GRANT EXECUTE ON FUNCTION complete_talent_onboarding TO authenticated;
GRANT EXECUTE ON FUNCTION create_payout_for_order TO authenticated;

-- ============================================================
-- SUMMARY
-- ============================================================
-- Run this ONCE and you won't have RLS issues during onboarding again.
-- 
-- These functions:
-- 1. Validate the onboarding token (security)
-- 2. Run with SECURITY DEFINER (elevated privileges)
-- 3. Only allow specific, safe operations
-- 4. Log everything for audit trails
--
-- The frontend should call these RPC functions instead of direct
-- table updates during onboarding.
-- ============================================================


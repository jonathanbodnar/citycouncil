-- Delete a talent profile and all related data (orders, notifications, etc.)
-- Replace 'USERNAME_HERE' with the actual username to delete

-- Step 1: Find the talent profile
DO $$
DECLARE
  talent_user_id UUID;
  talent_profile_id UUID;
  talent_username TEXT := 'testingauto'; -- CHANGE THIS
BEGIN
  -- Get talent IDs
  SELECT id, user_id INTO talent_profile_id, talent_user_id
  FROM talent_profiles
  WHERE username = talent_username;

  IF talent_profile_id IS NULL THEN
    RAISE NOTICE 'Talent profile not found: %', talent_username;
    RETURN;
  END IF;

  RAISE NOTICE 'Found talent: % (profile_id: %, user_id: %)', talent_username, talent_profile_id, talent_user_id;

  -- Step 2: Delete notifications for orders belonging to this talent
  DELETE FROM notifications
  WHERE order_id IN (
    SELECT id FROM orders WHERE talent_id = talent_profile_id
  );
  RAISE NOTICE '✅ Deleted notifications for talent orders';

  -- Step 3: Delete notifications for the talent user
  DELETE FROM notifications
  WHERE user_id = talent_user_id;
  RAISE NOTICE '✅ Deleted notifications for talent user';

  -- Step 4: Delete short links for orders belonging to this talent
  DELETE FROM short_links
  WHERE long_url LIKE '%' || (
    SELECT fulfillment_token FROM orders WHERE talent_id = talent_profile_id LIMIT 1
  ) || '%'
  OR id IN (
    SELECT short_link_id FROM orders WHERE talent_id = talent_profile_id AND short_link_id IS NOT NULL
  );
  RAISE NOTICE '✅ Deleted short links';

  -- Step 5: Delete orders for this talent
  DELETE FROM orders
  WHERE talent_id = talent_profile_id;
  RAISE NOTICE '✅ Deleted orders';

  -- Step 6: Delete social accounts for this talent
  DELETE FROM social_accounts
  WHERE talent_id = talent_profile_id;
  RAISE NOTICE '✅ Deleted social accounts';

  -- Step 7: Delete notification settings for talent user
  DELETE FROM notification_settings
  WHERE user_id = talent_user_id;
  RAISE NOTICE '✅ Deleted notification settings';

  -- Step 8: Delete talent profile
  DELETE FROM talent_profiles
  WHERE id = talent_profile_id;
  RAISE NOTICE '✅ Deleted talent profile';

  -- Step 9: Delete user record from public.users
  DELETE FROM users
  WHERE id = talent_user_id;
  RAISE NOTICE '✅ Deleted user record';

  -- Step 10: Delete auth.users record (this also cascades to related auth tables)
  DELETE FROM auth.users
  WHERE id = talent_user_id;
  RAISE NOTICE '✅ Deleted auth.users record';

  RAISE NOTICE '🎉 Successfully deleted talent: %', talent_username;
END $$;


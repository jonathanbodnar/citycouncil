-- Delete testingauto and hellownew talents with all related data

DO $$
DECLARE
  talent_record RECORD;
  deleted_count INT := 0;
BEGIN
  -- Loop through each talent to delete
  FOR talent_record IN 
    SELECT id, user_id, username, full_name
    FROM talent_profiles
    WHERE username IN ('testingauto', 'hellownew')
  LOOP
    RAISE NOTICE 'Deleting talent: % (%, user_id: %)', talent_record.username, talent_record.full_name, talent_record.user_id;

    -- Delete notifications for orders belonging to this talent
    DELETE FROM notifications WHERE order_id IN (SELECT id FROM orders WHERE talent_id = talent_record.id);
    
    -- Delete notifications for the talent user
    DELETE FROM notifications WHERE user_id = talent_record.user_id;
    
    -- Delete short links
    DELETE FROM short_links WHERE id IN (SELECT short_link_id FROM orders WHERE talent_id = talent_record.id AND short_link_id IS NOT NULL);
    
    -- Delete orders
    DELETE FROM orders WHERE talent_id = talent_record.id;
    
    -- Delete social accounts
    DELETE FROM social_accounts WHERE talent_id = talent_record.id;
    
    -- Delete notification settings
    DELETE FROM notification_settings WHERE user_id = talent_record.user_id;
    
    -- Delete talent profile
    DELETE FROM talent_profiles WHERE id = talent_record.id;
    
    -- Delete user record
    DELETE FROM users WHERE id = talent_record.user_id;
    
    -- Delete auth.users record
    DELETE FROM auth.users WHERE id = talent_record.user_id;
    
    deleted_count := deleted_count + 1;
    RAISE NOTICE '✅ Deleted talent: %', talent_record.username;
  END LOOP;

  IF deleted_count = 0 THEN
    RAISE NOTICE '⚠️  No talents found to delete';
  ELSE
    RAISE NOTICE '🎉 Successfully deleted % talent(s)', deleted_count;
  END IF;
END $$;


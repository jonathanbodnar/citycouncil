-- Automatically sync users.full_name to talent_profiles.full_name
-- This ensures talent names are ALWAYS in sync

-- Step 1: Create function to sync full_name
CREATE OR REPLACE FUNCTION sync_talent_full_name()
RETURNS TRIGGER AS $$
BEGIN
  -- When a user is inserted or updated, sync their full_name to talent_profiles
  UPDATE talent_profiles
  SET full_name = NEW.full_name
  WHERE user_id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Create trigger on users table
DROP TRIGGER IF EXISTS trigger_sync_talent_full_name ON users;
CREATE TRIGGER trigger_sync_talent_full_name
  AFTER INSERT OR UPDATE OF full_name ON users
  FOR EACH ROW
  EXECUTE FUNCTION sync_talent_full_name();

-- Step 3: Also create a trigger on talent_profiles when user_id is set
CREATE OR REPLACE FUNCTION sync_talent_full_name_on_link()
RETURNS TRIGGER AS $$
BEGIN
  -- When a talent_profile gets linked to a user, copy the full_name
  IF NEW.user_id IS NOT NULL AND (OLD.user_id IS NULL OR OLD.user_id != NEW.user_id) THEN
    UPDATE talent_profiles tp
    SET full_name = u.full_name
    FROM users u
    WHERE u.id = NEW.user_id
      AND tp.id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_talent_full_name_on_link ON talent_profiles;
CREATE TRIGGER trigger_sync_talent_full_name_on_link
  AFTER UPDATE OF user_id ON talent_profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_talent_full_name_on_link();

-- Step 4: Fix all existing talent profiles NOW (run the data migration)
UPDATE talent_profiles tp
SET full_name = u.full_name
FROM users u
WHERE tp.user_id = u.id
  AND u.full_name IS NOT NULL
  AND (tp.full_name IS NULL OR tp.full_name = '' OR tp.full_name != u.full_name);

-- Step 5: Verify results
SELECT 
  tp.username,
  u.full_name as user_full_name,
  tp.full_name as talent_full_name,
  CASE 
    WHEN tp.full_name = u.full_name THEN '✅ Synced'
    WHEN tp.full_name IS NULL THEN '❌ Missing'
    ELSE '⚠️ Mismatch'
  END as status
FROM talent_profiles tp
LEFT JOIN users u ON tp.user_id = u.id
WHERE tp.user_id IS NOT NULL
ORDER BY tp.created_at DESC
LIMIT 20;


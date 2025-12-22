-- Add SMS opt-out columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS sms_opted_out BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS sms_opted_out_at TIMESTAMPTZ;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_sms_opted_out ON users(sms_opted_out) WHERE sms_opted_out = TRUE;

-- Update the get_users_by_segment function to exclude opted-out users
CREATE OR REPLACE FUNCTION get_users_by_segment(segment TEXT)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  phone_number TEXT,
  email TEXT,
  user_tags TEXT[]
) AS $$
BEGIN
  IF segment = 'beta' THEN
    -- Beta users from landing page (beta_signups table)
    -- Exclude users who have opted out
    RETURN QUERY
    SELECT 
      bs.id,
      COALESCE(bs.full_name, 'Beta User') as full_name,
      bs.phone_number,
      bs.email,
      bs.user_tags
    FROM beta_signups bs
    WHERE bs.phone_number IS NOT NULL 
      AND bs.phone_number != ''
      AND bs.source != 'holiday_popup'
      AND NOT EXISTS (
        SELECT 1 FROM users u 
        WHERE (u.phone = bs.phone_number OR u.phone = REPLACE(bs.phone_number, '+1', '') OR '+1' || u.phone = bs.phone_number)
          AND u.sms_opted_out = TRUE
      );
      
  ELSIF segment = 'holiday_popup' THEN
    -- Holiday popup signups only
    -- Exclude users who have opted out
    RETURN QUERY
    SELECT 
      bs.id,
      COALESCE(bs.full_name, 'Holiday Promo') as full_name,
      bs.phone_number,
      bs.email,
      bs.user_tags
    FROM beta_signups bs
    WHERE bs.phone_number IS NOT NULL 
      AND bs.phone_number != ''
      AND bs.source = 'holiday_popup'
      AND NOT EXISTS (
        SELECT 1 FROM users u 
        WHERE (u.phone = bs.phone_number OR u.phone = REPLACE(bs.phone_number, '+1', '') OR '+1' || u.phone = bs.phone_number)
          AND u.sms_opted_out = TRUE
      );
      
  ELSIF segment = 'registered' THEN
    -- Registered users with phone numbers (excluding talent and opted-out)
    RETURN QUERY
    SELECT 
      u.id,
      COALESCE(u.full_name, 'Registered User') as full_name,
      u.phone as phone_number,
      u.email,
      ARRAY[]::TEXT[] as user_tags
    FROM users u
    WHERE u.phone IS NOT NULL 
      AND u.phone != ''
      AND u.user_type = 'user'
      AND (u.sms_opted_out IS NULL OR u.sms_opted_out = FALSE);
      
  ELSIF segment = 'talent' THEN
    -- Talent users with phone numbers (excluding opted-out)
    RETURN QUERY
    SELECT 
      u.id,
      COALESCE(tp.temp_full_name, u.full_name, 'Talent') as full_name,
      u.phone as phone_number,
      u.email,
      ARRAY[]::TEXT[] as user_tags
    FROM users u
    JOIN talent_profiles tp ON tp.user_id = u.id
    WHERE u.phone IS NOT NULL 
      AND u.phone != ''
      AND u.user_type = 'talent'
      AND (u.sms_opted_out IS NULL OR u.sms_opted_out = FALSE);
      
  ELSIF segment = 'all' THEN
    -- All phone numbers from beta_signups (excluding talent and opted-out)
    RETURN QUERY
    SELECT 
      bs.id,
      COALESCE(bs.full_name, 'User') as full_name,
      bs.phone_number,
      bs.email,
      bs.user_tags
    FROM beta_signups bs
    WHERE bs.phone_number IS NOT NULL 
      AND bs.phone_number != ''
      AND NOT EXISTS (
        SELECT 1 FROM users u 
        WHERE (u.phone = bs.phone_number OR u.phone = REPLACE(bs.phone_number, '+1', '') OR '+1' || u.phone = bs.phone_number)
          AND u.sms_opted_out = TRUE
      )
      -- Exclude talent phone numbers
      AND NOT EXISTS (
        SELECT 1 FROM users u 
        JOIN talent_profiles tp ON tp.user_id = u.id
        WHERE u.phone = bs.phone_number 
           OR u.phone = REPLACE(bs.phone_number, '+1', '')
           OR '+1' || u.phone = bs.phone_number
      );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_users_by_segment(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_users_by_segment(TEXT) TO service_role;

-- Also add media_url column to sms_logs if it doesn't exist
ALTER TABLE sms_logs 
ADD COLUMN IF NOT EXISTS media_url TEXT;


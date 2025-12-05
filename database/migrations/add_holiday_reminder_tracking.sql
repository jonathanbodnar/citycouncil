-- Add column to track if 6-hour reminder was sent
ALTER TABLE beta_signups 
ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ DEFAULT NULL;

-- Create index for efficient querying of pending reminders
CREATE INDEX IF NOT EXISTS idx_beta_signups_holiday_reminder 
ON beta_signups(source, subscribed_at, reminder_sent_at) 
WHERE source = 'holiday_popup' AND reminder_sent_at IS NULL;

-- Function to get holiday popup users who need the 6-hour reminder
-- (signed up 42 hours ago, countdown has 6 hours left)
CREATE OR REPLACE FUNCTION get_holiday_popup_reminder_recipients()
RETURNS TABLE (
  id UUID,
  phone_number TEXT,
  subscribed_at TIMESTAMPTZ,
  hours_since_signup NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bs.id,
    bs.phone_number,
    bs.subscribed_at,
    EXTRACT(EPOCH FROM (NOW() - bs.subscribed_at)) / 3600 as hours_since_signup
  FROM beta_signups bs
  WHERE bs.source = 'holiday_popup'
    AND bs.reminder_sent_at IS NULL
    -- Between 42 and 43 hours since signup (6-5 hours left on 48hr countdown)
    AND bs.subscribed_at <= NOW() - INTERVAL '42 hours'
    AND bs.subscribed_at > NOW() - INTERVAL '43 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mark reminder as sent
CREATE OR REPLACE FUNCTION mark_holiday_reminder_sent(signup_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE beta_signups 
  SET reminder_sent_at = NOW()
  WHERE id = signup_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Test query to see who would get reminders
SELECT 
  'Pending Reminders' as status,
  COUNT(*) as count
FROM beta_signups
WHERE source = 'holiday_popup'
  AND reminder_sent_at IS NULL;


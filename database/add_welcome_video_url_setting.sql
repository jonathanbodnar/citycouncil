-- Add welcome_video_url setting to platform_settings if it doesn't exist
INSERT INTO platform_settings (
  setting_key,
  setting_value,
  setting_type,
  description,
  created_at,
  updated_at
)
VALUES (
  'welcome_video_url',
  '',
  'string',
  'Welcome page video URL',
  NOW(),
  NOW()
)
ON CONFLICT (setting_key) DO NOTHING;

-- Verify the setting was created
SELECT * FROM platform_settings WHERE setting_key = 'welcome_video_url';


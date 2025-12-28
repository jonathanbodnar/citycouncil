-- Add Christmas mode setting to platform_settings
INSERT INTO public.platform_settings (setting_key, setting_value, setting_type, description)
VALUES (
  'christmas_mode_enabled',
  'false',
  'boolean',
  'Enable Christmas-themed features (delivery banners, Christmas Games on talent dashboard)'
)
ON CONFLICT (setting_key) DO UPDATE
SET description = EXCLUDED.description;


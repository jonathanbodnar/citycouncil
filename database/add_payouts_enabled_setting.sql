-- Add 'payouts_enabled' setting to platform_settings table
-- This allows admins to globally enable/disable payout functionality before soft launch

INSERT INTO platform_settings (setting_key, setting_value, setting_type, description, created_at, updated_at)
VALUES (
  'payouts_enabled',
  'false',
  'boolean',
  'Enable or disable payout functionality globally (Moov/Plaid verification)',
  NOW(),
  NOW()
)
ON CONFLICT (setting_key) DO NOTHING;


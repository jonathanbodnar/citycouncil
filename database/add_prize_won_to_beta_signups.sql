-- Add prize_won column to beta_signups for instant giveaway
ALTER TABLE beta_signups 
ADD COLUMN IF NOT EXISTS prize_won TEXT;

-- Create coupons for the new prizes if they don't exist
INSERT INTO coupons (code, discount_type, discount_value, is_active, usage_limit, times_used, created_at)
VALUES 
  ('SAVE15', 'percentage', 15, true, null, 0, NOW()),
  ('SAVE10', 'percentage', 10, true, null, 0, NOW()),
  ('TAKE25', 'fixed', 25, true, null, 0, NOW())
ON CONFLICT (code) DO NOTHING;


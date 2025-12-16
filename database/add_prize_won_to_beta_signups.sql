-- Add prize_won column to beta_signups for instant giveaway
ALTER TABLE beta_signups 
ADD COLUMN IF NOT EXISTS prize_won TEXT;

-- Create coupons for the new prizes if they don't exist
INSERT INTO coupons (code, description, discount_type, discount_value, is_active, max_uses, max_uses_per_user, used_count, valid_from, created_at)
VALUES 
  ('SAVE15', 'Instant Giveaway - 15% Off', 'percentage', 15, true, null, 1, 0, NOW(), NOW()),
  ('SAVE10', 'Instant Giveaway - 10% Off', 'percentage', 10, true, null, 1, 0, NOW(), NOW()),
  ('TAKE25', 'Instant Giveaway - $25 Off', 'fixed', 25, true, null, 1, 0, NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

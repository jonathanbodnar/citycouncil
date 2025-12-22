-- Add referrer tracking to beta_signups
ALTER TABLE beta_signups 
ADD COLUMN IF NOT EXISTS referrer TEXT,
ADD COLUMN IF NOT EXISTS referrer_domain TEXT;

-- Add referrer tracking to users table as well
ALTER TABLE users
ADD COLUMN IF NOT EXISTS referrer TEXT,
ADD COLUMN IF NOT EXISTS referrer_domain TEXT;

-- Add referrer tracking to orders table
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS referrer TEXT,
ADD COLUMN IF NOT EXISTS referrer_domain TEXT;

-- Create index for referrer analysis
CREATE INDEX IF NOT EXISTS idx_beta_signups_referrer_domain ON beta_signups(referrer_domain);
CREATE INDEX IF NOT EXISTS idx_users_referrer_domain ON users(referrer_domain);
CREATE INDEX IF NOT EXISTS idx_orders_referrer_domain ON orders(referrer_domain);

-- Comment explaining the fields
COMMENT ON COLUMN beta_signups.referrer IS 'Full referrer URL from document.referrer';
COMMENT ON COLUMN beta_signups.referrer_domain IS 'Extracted domain from referrer (e.g., google.com, facebook.com)';


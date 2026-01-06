-- Add email column to beta_signups for capturing emails from login form
-- This allows us to capture leads even if they don't complete registration

-- Add email column (nullable, since existing records won't have it)
ALTER TABLE beta_signups 
ADD COLUMN IF NOT EXISTS email TEXT;

-- Create unique index on email (partial - only for non-null values)
-- This prevents duplicate emails but allows multiple null values
CREATE UNIQUE INDEX IF NOT EXISTS idx_beta_signups_email_unique 
ON beta_signups(email) 
WHERE email IS NOT NULL;

-- Create regular index for lookups
CREATE INDEX IF NOT EXISTS idx_beta_signups_email 
ON beta_signups(email) 
WHERE email IS NOT NULL;

-- Update the phone_number constraint to allow null (for email-only captures)
-- First drop the NOT NULL constraint if it exists
ALTER TABLE beta_signups 
ALTER COLUMN phone_number DROP NOT NULL;

-- Drop the unique constraint on phone_number and recreate as partial
-- (allows multiple nulls but unique non-null values)
DROP INDEX IF EXISTS beta_signups_phone_number_key;
DROP INDEX IF EXISTS idx_beta_signups_phone;

CREATE UNIQUE INDEX IF NOT EXISTS idx_beta_signups_phone_unique 
ON beta_signups(phone_number) 
WHERE phone_number IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN beta_signups.email IS 'Email captured from login form (even if registration not completed)';

-- Verify the changes
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'beta_signups' 
ORDER BY ordinal_position;


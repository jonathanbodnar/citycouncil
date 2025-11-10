-- Add last_login tracking to users table
-- This will track when users (including talent during onboarding) last logged in

-- Add last_login column
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;

-- Add index for querying by last login
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login);

-- Add comment
COMMENT ON COLUMN users.last_login IS 'Timestamp of user last login (including onboarding access)';

-- Update existing users to have a default last_login (their created_at)
UPDATE users 
SET last_login = created_at 
WHERE last_login IS NULL;


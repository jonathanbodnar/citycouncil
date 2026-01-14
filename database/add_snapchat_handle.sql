-- Add snapchat_handle column to talent_profiles table
ALTER TABLE talent_profiles ADD COLUMN IF NOT EXISTS snapchat_handle TEXT;

-- Add comment to explain the column
COMMENT ON COLUMN talent_profiles.snapchat_handle IS 'Snapchat username (without @ symbol)';

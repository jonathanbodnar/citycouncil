-- Migration: Add talent management and onboarding features
-- Date: 2024-10-20
-- Description: Add username, onboarding tokens, and platform settings

-- Add username and onboarding fields to talent_profiles
ALTER TABLE talent_profiles 
ADD COLUMN username VARCHAR(50) UNIQUE,
ADD COLUMN onboarding_token VARCHAR(255) UNIQUE,
ADD COLUMN onboarding_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN onboarding_expires_at TIMESTAMP WITH TIME ZONE;

-- Create unique index on username (case insensitive)
CREATE UNIQUE INDEX idx_talent_profiles_username_lower ON talent_profiles(LOWER(username));

-- Create index on onboarding token
CREATE INDEX idx_talent_profiles_onboarding_token ON talent_profiles(onboarding_token);

-- Create platform_settings table for logo and other settings
CREATE TABLE platform_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value TEXT,
    setting_type VARCHAR(20) DEFAULT 'string' CHECK (setting_type IN ('string', 'boolean', 'number', 'json', 'file')),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES users(id)
);

-- Create index on setting_key
CREATE INDEX idx_platform_settings_key ON platform_settings(setting_key);

-- Create trigger for platform_settings updated_at
CREATE TRIGGER update_platform_settings_updated_at 
    BEFORE UPDATE ON platform_settings 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default platform settings
INSERT INTO platform_settings (setting_key, setting_value, setting_type, description) VALUES
('platform_logo_url', NULL, 'string', 'URL to the platform logo image'),
('platform_name', 'ShoutOut', 'string', 'Name of the platform'),
('default_admin_fee_percentage', '15', 'number', 'Default admin fee percentage for new talent'),
('onboarding_token_expiry_hours', '168', 'number', 'Hours until onboarding token expires (default 7 days)');

-- Add comments
COMMENT ON TABLE platform_settings IS 'Stores platform-wide configuration settings';
COMMENT ON COLUMN talent_profiles.username IS 'Unique username for talent profile URL (shoutout.us/username)';
COMMENT ON COLUMN talent_profiles.onboarding_token IS 'Unique token for talent onboarding signup link';
COMMENT ON COLUMN talent_profiles.onboarding_completed IS 'Whether talent has completed the onboarding process';
COMMENT ON COLUMN talent_profiles.onboarding_expires_at IS 'When the onboarding token expires';

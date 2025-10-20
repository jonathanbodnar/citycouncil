-- Complete Migration: Fortis Pay + Talent Management Integration
-- Date: 2024-10-20
-- Description: Combined migration for Fortis Pay and talent management features
-- Compatible with Supabase SQL Editor

-- This script combines:
-- - 001_add_fortis_tables.sql (Fortis Pay integration)
-- - 002_add_talent_management.sql (Talent management & onboarding)

BEGIN;

-- ============================================================================
-- PART 1: FORTIS PAY INTEGRATION
-- ============================================================================

-- Add fortis_vendor_id to talent_profiles table
ALTER TABLE talent_profiles 
ADD COLUMN IF NOT EXISTS fortis_vendor_id VARCHAR(255);

-- Create payouts table
CREATE TABLE IF NOT EXISTS payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    talent_id UUID NOT NULL REFERENCES talent_profiles(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    vendor_id VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'processed', 'failed', 'cancelled')),
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fortis_transaction_id VARCHAR(255),
    error_message TEXT
);

-- Create indexes for payouts table
CREATE INDEX IF NOT EXISTS idx_payouts_talent_id ON payouts(talent_id);
CREATE INDEX IF NOT EXISTS idx_payouts_order_id ON payouts(order_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts(status);
CREATE INDEX IF NOT EXISTS idx_payouts_created_at ON payouts(created_at DESC);

-- Create payout_errors table for failed payouts that need manual review
CREATE TABLE IF NOT EXISTS payout_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    talent_id UUID NOT NULL REFERENCES talent_profiles(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    error_message TEXT NOT NULL,
    resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for payout_errors table
CREATE INDEX IF NOT EXISTS idx_payout_errors_talent_id ON payout_errors(talent_id);
CREATE INDEX IF NOT EXISTS idx_payout_errors_resolved ON payout_errors(resolved);
CREATE INDEX IF NOT EXISTS idx_payout_errors_created_at ON payout_errors(created_at DESC);

-- Create vendor_bank_info table for talent banking details
CREATE TABLE IF NOT EXISTS vendor_bank_info (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    talent_id UUID NOT NULL REFERENCES talent_profiles(id) ON DELETE CASCADE,
    account_holder_name VARCHAR(255) NOT NULL,
    bank_name VARCHAR(255) NOT NULL,
    account_number VARCHAR(255) NOT NULL,
    routing_number VARCHAR(20) NOT NULL,
    account_type VARCHAR(20) NOT NULL DEFAULT 'checking' 
        CHECK (account_type IN ('checking', 'savings')),
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique constraint - one bank account per talent
CREATE UNIQUE INDEX IF NOT EXISTS idx_vendor_bank_info_talent_id ON vendor_bank_info(talent_id);

-- ============================================================================
-- PART 2: TALENT MANAGEMENT & ONBOARDING
-- ============================================================================

-- Add username and onboarding fields to talent_profiles
DO $$
BEGIN
    -- Add username column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'talent_profiles' AND column_name = 'username'
    ) THEN
        ALTER TABLE talent_profiles ADD COLUMN username VARCHAR(50);
    END IF;

    -- Add onboarding_token column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'talent_profiles' AND column_name = 'onboarding_token'
    ) THEN
        ALTER TABLE talent_profiles ADD COLUMN onboarding_token VARCHAR(255);
    END IF;

    -- Add onboarding_completed column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'talent_profiles' AND column_name = 'onboarding_completed'
    ) THEN
        ALTER TABLE talent_profiles ADD COLUMN onboarding_completed BOOLEAN DEFAULT FALSE;
    END IF;

    -- Add onboarding_expires_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'talent_profiles' AND column_name = 'onboarding_expires_at'
    ) THEN
        ALTER TABLE talent_profiles ADD COLUMN onboarding_expires_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Create unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_talent_profiles_username ON talent_profiles(username) WHERE username IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_talent_profiles_username_lower ON talent_profiles(LOWER(username)) WHERE username IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_talent_profiles_onboarding_token ON talent_profiles(onboarding_token) WHERE onboarding_token IS NOT NULL;

-- Create platform_settings table for logo and other settings
CREATE TABLE IF NOT EXISTS platform_settings (
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
CREATE INDEX IF NOT EXISTS idx_platform_settings_key ON platform_settings(setting_key);

-- ============================================================================
-- PART 3: TRIGGERS AND FUNCTIONS
-- ============================================================================

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at columns
DROP TRIGGER IF EXISTS update_payouts_updated_at ON payouts;
CREATE TRIGGER update_payouts_updated_at 
    BEFORE UPDATE ON payouts 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_vendor_bank_info_updated_at ON vendor_bank_info;
CREATE TRIGGER update_vendor_bank_info_updated_at 
    BEFORE UPDATE ON vendor_bank_info 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_platform_settings_updated_at ON platform_settings;
CREATE TRIGGER update_platform_settings_updated_at 
    BEFORE UPDATE ON platform_settings 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PART 4: DEFAULT DATA AND SETTINGS
-- ============================================================================

-- Insert default platform settings (using ON CONFLICT to avoid duplicates)
INSERT INTO platform_settings (setting_key, setting_value, setting_type, description) VALUES
('platform_logo_url', NULL, 'string', 'URL to the platform logo image'),
('platform_name', 'ShoutOut', 'string', 'Name of the platform'),
('default_admin_fee_percentage', '15', 'number', 'Default admin fee percentage for new talent'),
('onboarding_token_expiry_hours', '168', 'number', 'Hours until onboarding token expires (default 7 days)')
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================================================
-- PART 5: COMMENTS AND DOCUMENTATION
-- ============================================================================

-- Add comments to tables for documentation
COMMENT ON TABLE payouts IS 'Tracks all payouts made to talent through Fortis Pay';
COMMENT ON TABLE payout_errors IS 'Logs failed payout attempts for manual review and resolution';
COMMENT ON TABLE vendor_bank_info IS 'Stores banking information for talent payouts';
COMMENT ON TABLE platform_settings IS 'Stores platform-wide configuration settings';

-- Add comments to columns
COMMENT ON COLUMN talent_profiles.fortis_vendor_id IS 'Fortis vendor ID for this talent member';
COMMENT ON COLUMN talent_profiles.username IS 'Unique username for talent profile URL (shoutout.us/username)';
COMMENT ON COLUMN talent_profiles.onboarding_token IS 'Unique token for talent onboarding signup link';
COMMENT ON COLUMN talent_profiles.onboarding_completed IS 'Whether talent has completed the onboarding process';
COMMENT ON COLUMN talent_profiles.onboarding_expires_at IS 'When the onboarding token expires';

COMMENT ON COLUMN payouts.vendor_id IS 'Fortis vendor ID used for the payout';
COMMENT ON COLUMN payouts.fortis_transaction_id IS 'Fortis transaction ID for the payout';
COMMENT ON COLUMN vendor_bank_info.is_verified IS 'Whether the bank account has been verified by admin';

COMMIT;

-- Migration completed successfully!
-- 
-- SUMMARY OF CHANGES:
-- 
-- FORTIS PAY INTEGRATION:
-- ✅ payouts table (talent payout tracking)
-- ✅ payout_errors table (failed payout logging)
-- ✅ vendor_bank_info table (talent banking details)
-- ✅ talent_profiles.fortis_vendor_id (vendor linking)
-- 
-- TALENT MANAGEMENT:
-- ✅ talent_profiles.username (unique usernames)
-- ✅ talent_profiles.onboarding_* (onboarding system)
-- ✅ platform_settings table (logo & configuration)
-- ✅ Unique indexes and constraints
-- ✅ Automatic triggers for updated_at fields
-- 
-- NEXT STEPS:
-- 1. Add Fortis API keys to Railway environment
-- 2. Create "platform-assets" bucket in Supabase Storage
-- 3. Test talent onboarding flow
-- 4. Upload platform logo via admin panel
-- 
-- Environment variables needed:
-- REACT_APP_FORTIS_API_KEY=your_api_key
-- REACT_APP_FORTIS_API_SECRET=your_api_secret
-- REACT_APP_FORTIS_ENV=sandbox

-- Migration: Add Fortis Pay integration tables
-- Date: 2024-10-20
-- Description: Create tables for payouts, payout errors, vendor bank info, and update talent profiles

-- Add fortis_vendor_id to talent_profiles table
ALTER TABLE talent_profiles 
ADD COLUMN fortis_vendor_id VARCHAR(255);

-- Create payouts table
CREATE TABLE payouts (
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
CREATE INDEX idx_payouts_talent_id ON payouts(talent_id);
CREATE INDEX idx_payouts_order_id ON payouts(order_id);
CREATE INDEX idx_payouts_status ON payouts(status);
CREATE INDEX idx_payouts_created_at ON payouts(created_at DESC);

-- Create payout_errors table for failed payouts that need manual review
CREATE TABLE payout_errors (
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
CREATE INDEX idx_payout_errors_talent_id ON payout_errors(talent_id);
CREATE INDEX idx_payout_errors_resolved ON payout_errors(resolved);
CREATE INDEX idx_payout_errors_created_at ON payout_errors(created_at DESC);

-- Create vendor_bank_info table for talent banking details
CREATE TABLE vendor_bank_info (
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
CREATE UNIQUE INDEX idx_vendor_bank_info_talent_id ON vendor_bank_info(talent_id);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at columns
CREATE TRIGGER update_payouts_updated_at 
    BEFORE UPDATE ON payouts 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vendor_bank_info_updated_at 
    BEFORE UPDATE ON vendor_bank_info 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments to tables for documentation
COMMENT ON TABLE payouts IS 'Tracks all payouts made to talent through Fortis Pay';
COMMENT ON TABLE payout_errors IS 'Logs failed payout attempts for manual review and resolution';
COMMENT ON TABLE vendor_bank_info IS 'Stores banking information for talent payouts';

COMMENT ON COLUMN talent_profiles.fortis_vendor_id IS 'Fortis vendor ID for this talent member';
COMMENT ON COLUMN payouts.vendor_id IS 'Fortis vendor ID used for the payout';
COMMENT ON COLUMN payouts.fortis_transaction_id IS 'Fortis transaction ID for the payout';
COMMENT ON COLUMN vendor_bank_info.is_verified IS 'Whether the bank account has been verified by admin';

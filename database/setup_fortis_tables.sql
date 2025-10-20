-- Fortis Pay Database Setup Script
-- Run this script in your PostgreSQL database to set up the required tables
-- 
-- Prerequisites: 
-- - talent_profiles table must exist
-- - orders table must exist
--
-- Usage: 
-- psql -d your_database -f setup_fortis_tables.sql

\echo 'Setting up Fortis Pay integration tables...'

BEGIN;

-- Check if required tables exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'talent_profiles') THEN
        RAISE EXCEPTION 'talent_profiles table does not exist. Please create it first.';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders') THEN
        RAISE EXCEPTION 'orders table does not exist. Please create it first.';
    END IF;
END $$;

-- Add fortis_vendor_id to talent_profiles table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'talent_profiles' AND column_name = 'fortis_vendor_id'
    ) THEN
        ALTER TABLE talent_profiles ADD COLUMN fortis_vendor_id VARCHAR(255);
        \echo 'Added fortis_vendor_id column to talent_profiles table';
    ELSE
        \echo 'fortis_vendor_id column already exists in talent_profiles table';
    END IF;
END $$;

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

\echo 'Created payouts table with indexes';

-- Create payout_errors table
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

\echo 'Created payout_errors table with indexes';

-- Create vendor_bank_info table
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

\echo 'Created vendor_bank_info table with unique constraint';

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

\echo 'Created triggers for automatic updated_at timestamps';

-- Add comments to tables for documentation
COMMENT ON TABLE payouts IS 'Tracks all payouts made to talent through Fortis Pay';
COMMENT ON TABLE payout_errors IS 'Logs failed payout attempts for manual review and resolution';
COMMENT ON TABLE vendor_bank_info IS 'Stores banking information for talent payouts';

COMMENT ON COLUMN talent_profiles.fortis_vendor_id IS 'Fortis vendor ID for this talent member';
COMMENT ON COLUMN payouts.vendor_id IS 'Fortis vendor ID used for the payout';
COMMENT ON COLUMN payouts.fortis_transaction_id IS 'Fortis transaction ID for the payout';
COMMENT ON COLUMN vendor_bank_info.is_verified IS 'Whether the bank account has been verified by admin';

\echo 'Added table and column comments';

COMMIT;

\echo 'Fortis Pay integration tables setup completed successfully!';
\echo '';
\echo 'Tables created:';
\echo '- payouts (with indexes)';
\echo '- payout_errors (with indexes)'; 
\echo '- vendor_bank_info (with unique constraint)';
\echo '';
\echo 'Column added:';
\echo '- talent_profiles.fortis_vendor_id';
\echo '';
\echo 'Next steps:';
\echo '1. Add Fortis API keys to your environment variables';
\echo '2. Test the payment flow in sandbox mode';
\echo '3. Set up admin access to review payout errors';

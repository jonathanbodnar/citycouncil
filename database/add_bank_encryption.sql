-- Add encryption fields to vendor_bank_info table
-- This migration adds encrypted storage for sensitive bank account information

-- Add encrypted fields for account number
ALTER TABLE vendor_bank_info 
ADD COLUMN IF NOT EXISTS account_number_encrypted TEXT,
ADD COLUMN IF NOT EXISTS account_number_iv TEXT,
ADD COLUMN IF NOT EXISTS account_number_masked VARCHAR(50);

-- Add encrypted fields for routing number  
ALTER TABLE vendor_bank_info 
ADD COLUMN IF NOT EXISTS routing_number_encrypted TEXT,
ADD COLUMN IF NOT EXISTS routing_number_iv TEXT,
ADD COLUMN IF NOT EXISTS routing_number_masked VARCHAR(50);

-- Make original fields nullable (will be deprecated)
ALTER TABLE vendor_bank_info 
ALTER COLUMN account_number DROP NOT NULL,
ALTER COLUMN routing_number DROP NOT NULL;

-- Add comments for new fields
COMMENT ON COLUMN vendor_bank_info.account_number_encrypted IS 'AES-256-GCM encrypted bank account number';
COMMENT ON COLUMN vendor_bank_info.account_number_iv IS 'Initialization vector for account number encryption';
COMMENT ON COLUMN vendor_bank_info.account_number_masked IS 'Masked account number for display (****1234)';
COMMENT ON COLUMN vendor_bank_info.routing_number_encrypted IS 'AES-256-GCM encrypted routing number';
COMMENT ON COLUMN vendor_bank_info.routing_number_iv IS 'Initialization vector for routing number encryption';
COMMENT ON COLUMN vendor_bank_info.routing_number_masked IS 'Masked routing number for display (1234****)';

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_vendor_bank_info_encrypted ON vendor_bank_info(talent_id, account_number_encrypted);

-- Security note: The encryption key should be stored securely in environment variables
-- Never store the encryption key in the database or version control

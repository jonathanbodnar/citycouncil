-- Safe Migration: Add W-9 storage and payout onboarding progress tracking
-- This version checks if things exist before creating them
-- Date: 2024-11-18

-- Create W-9s table for storing completed W-9 forms
CREATE TABLE IF NOT EXISTS w9_forms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    talent_id UUID NOT NULL REFERENCES talent_profiles(id) ON DELETE CASCADE,
    
    -- W-9 Form Data (non-sensitive info stored in DB)
    name VARCHAR(255) NOT NULL,
    business_name VARCHAR(255),
    tax_classification VARCHAR(50) NOT NULL CHECK (tax_classification IN (
        'individual', 
        'c_corporation', 
        's_corporation', 
        'partnership', 
        'trust_estate', 
        'llc_c', 
        'llc_s', 
        'llc_p', 
        'other'
    )),
    other_tax_classification VARCHAR(100),
    exempt_payee_code VARCHAR(10),
    exemption_from_fatca_code VARCHAR(10),
    address_line1 VARCHAR(255) NOT NULL,
    address_line2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(2) NOT NULL,
    zip_code VARCHAR(10) NOT NULL,
    
    -- SSN/EIN is NOT stored in our database - only used for PDF generation
    -- The PDF is generated on-demand and stored securely
    
    -- Signature data (stored as data URL)
    signature_data_url TEXT NOT NULL,
    signature_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- PDF storage reference (generated PDF stored in secure bucket)
    pdf_storage_url TEXT,
    pdf_generated_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique constraint - one W-9 per talent
CREATE UNIQUE INDEX IF NOT EXISTS idx_w9_forms_talent_id ON w9_forms(talent_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_w9_forms_created_at ON w9_forms(created_at DESC);

-- Add payout onboarding progress tracking to talent_profiles
DO $$
BEGIN
    -- Add payout onboarding step tracking
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'talent_profiles' AND column_name = 'payout_onboarding_step'
    ) THEN
        ALTER TABLE talent_profiles ADD COLUMN payout_onboarding_step INTEGER DEFAULT 0;
    END IF;
    
    -- Add payout onboarding completed flag
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'talent_profiles' AND column_name = 'payout_onboarding_completed'
    ) THEN
        ALTER TABLE talent_profiles ADD COLUMN payout_onboarding_completed BOOLEAN DEFAULT FALSE;
    END IF;
    
    -- Add bank_account_linked flag
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'talent_profiles' AND column_name = 'bank_account_linked'
    ) THEN
        ALTER TABLE talent_profiles ADD COLUMN bank_account_linked BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Create indexes for payout onboarding
CREATE INDEX IF NOT EXISTS idx_talent_profiles_payout_onboarding_step 
    ON talent_profiles(payout_onboarding_step);
CREATE INDEX IF NOT EXISTS idx_talent_profiles_payout_onboarding_completed 
    ON talent_profiles(payout_onboarding_completed);

-- Enable RLS
ALTER TABLE w9_forms ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Talent can view own W-9" ON w9_forms;
DROP POLICY IF EXISTS "Talent can insert own W-9" ON w9_forms;
DROP POLICY IF EXISTS "Admins can view all W-9s" ON w9_forms;

-- Recreate RLS policies for w9_forms

-- Talent can view their own W-9
CREATE POLICY "Talent can view own W-9"
    ON w9_forms FOR SELECT
    USING (
        talent_id IN (
            SELECT id FROM talent_profiles WHERE user_id = auth.uid()
        )
    );

-- Talent can insert their own W-9 (one-time only)
CREATE POLICY "Talent can insert own W-9"
    ON w9_forms FOR INSERT
    WITH CHECK (
        talent_id IN (
            SELECT id FROM talent_profiles WHERE user_id = auth.uid()
        )
        AND NOT EXISTS (
            SELECT 1 FROM w9_forms WHERE talent_id = w9_forms.talent_id
        )
    );

-- Admins can view all W-9s
CREATE POLICY "Admins can view all W-9s"
    ON w9_forms FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users WHERE id = auth.uid() AND user_type = 'admin'
        )
    );

-- Create trigger function for w9_forms updated_at
CREATE OR REPLACE FUNCTION update_w9_forms_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS update_w9_forms_updated_at ON w9_forms;
CREATE TRIGGER update_w9_forms_updated_at
    BEFORE UPDATE ON w9_forms
    FOR EACH ROW
    EXECUTE FUNCTION update_w9_forms_updated_at();

-- Add comments
COMMENT ON TABLE w9_forms IS 'Stores W-9 form data for talent payouts (SSN/EIN NOT stored here)';
COMMENT ON COLUMN w9_forms.signature_data_url IS 'Base64 data URL of the signature image';
COMMENT ON COLUMN w9_forms.pdf_storage_url IS 'URL to the generated W-9 PDF in secure storage';
COMMENT ON COLUMN talent_profiles.payout_onboarding_step IS 'Current step in payout onboarding: 0=not started, 1=w9, 2=moov, 3=plaid, 4=completed';
COMMENT ON COLUMN talent_profiles.payout_onboarding_completed IS 'Whether talent has completed full payout onboarding';
COMMENT ON COLUMN talent_profiles.bank_account_linked IS 'Whether talent has linked their bank account via Plaid';


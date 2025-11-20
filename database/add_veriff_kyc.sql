-- Migration: Add Veriff KYC verification for payout onboarding
-- Date: 2024-11-19
-- Description: Create table to track Veriff identity verification sessions

-- Create veriff_sessions table
CREATE TABLE IF NOT EXISTS veriff_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    talent_id UUID NOT NULL REFERENCES talent_profiles(id) ON DELETE CASCADE,
    session_id VARCHAR(255) NOT NULL UNIQUE,
    session_url TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'started', 'submitted', 'approved', 'declined', 'resubmission_requested', 'expired', 'abandoned')),
    verification_code VARCHAR(10),
    person_id_code VARCHAR(255),
    person_given_name VARCHAR(255),
    person_last_name VARCHAR(255),
    person_date_of_birth DATE,
    person_country VARCHAR(3),
    document_type VARCHAR(50),
    document_number VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    decision_time TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT unique_talent_veriff_session UNIQUE(talent_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_veriff_sessions_talent_id ON veriff_sessions(talent_id);
CREATE INDEX IF NOT EXISTS idx_veriff_sessions_session_id ON veriff_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_veriff_sessions_status ON veriff_sessions(status);

-- RLS Policies
ALTER TABLE veriff_sessions ENABLE ROW LEVEL SECURITY;

-- Talent can view their own sessions
DROP POLICY IF EXISTS "Talent can view own Veriff session" ON veriff_sessions;
CREATE POLICY "Talent can view own Veriff session"
    ON veriff_sessions
    FOR SELECT
    USING (
        talent_id IN (
            SELECT id FROM talent_profiles WHERE user_id = auth.uid()
        )
    );

-- Admin can view all sessions
DROP POLICY IF EXISTS "Admin can view all Veriff sessions" ON veriff_sessions;
CREATE POLICY "Admin can view all Veriff sessions"
    ON veriff_sessions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users WHERE id = auth.uid() AND user_type = 'admin'
        )
    );

-- Service role can do everything (for edge functions and webhooks)
DROP POLICY IF EXISTS "Service role can manage Veriff sessions" ON veriff_sessions;
CREATE POLICY "Service role can manage Veriff sessions"
    ON veriff_sessions
    FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- Add veriff_verified column to talent_profiles
ALTER TABLE talent_profiles 
ADD COLUMN IF NOT EXISTS veriff_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS veriff_verified_at TIMESTAMP WITH TIME ZONE;

-- Create index
CREATE INDEX IF NOT EXISTS idx_talent_profiles_veriff_verified ON talent_profiles(veriff_verified);

-- Add comment
COMMENT ON TABLE veriff_sessions IS 'Stores Veriff identity verification sessions for KYC compliance';
COMMENT ON COLUMN talent_profiles.veriff_verified IS 'Whether the talent has completed Veriff identity verification';


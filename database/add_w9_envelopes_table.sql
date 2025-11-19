-- Migration: Add SignatureAPI envelope tracking for W-9s
-- Date: 2024-11-18
-- Description: Create table to track SignatureAPI envelopes for W-9 signing

-- Create w9_envelopes table
CREATE TABLE IF NOT EXISTS w9_envelopes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    talent_id UUID NOT NULL REFERENCES talent_profiles(id) ON DELETE CASCADE,
    envelope_id VARCHAR(255) NOT NULL UNIQUE,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'viewed', 'completed', 'declined', 'expired')),
    signing_url TEXT,
    signed_document_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT unique_talent_w9_envelope UNIQUE(talent_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_w9_envelopes_talent_id ON w9_envelopes(talent_id);
CREATE INDEX IF NOT EXISTS idx_w9_envelopes_envelope_id ON w9_envelopes(envelope_id);
CREATE INDEX IF NOT EXISTS idx_w9_envelopes_status ON w9_envelopes(status);

-- RLS Policies
ALTER TABLE w9_envelopes ENABLE ROW LEVEL SECURITY;

-- Talent can view their own envelopes
DROP POLICY IF EXISTS "Talent can view own W-9 envelope" ON w9_envelopes;
CREATE POLICY "Talent can view own W-9 envelope"
    ON w9_envelopes
    FOR SELECT
    USING (
        talent_id IN (
            SELECT id FROM talent_profiles WHERE user_id = auth.uid()
        )
    );

-- Admin can view all envelopes
DROP POLICY IF EXISTS "Admin can view all W-9 envelopes" ON w9_envelopes;
CREATE POLICY "Admin can view all W-9 envelopes"
    ON w9_envelopes
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users WHERE id = auth.uid() AND user_type = 'admin'
        )
    );

-- Service role can do everything (for webhooks)
DROP POLICY IF EXISTS "Service role can manage W-9 envelopes" ON w9_envelopes;
CREATE POLICY "Service role can manage W-9 envelopes"
    ON w9_envelopes
    FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- Talent can insert their own envelope (when creating)
DROP POLICY IF EXISTS "Talent can create own W-9 envelope" ON w9_envelopes;
CREATE POLICY "Talent can create own W-9 envelope"
    ON w9_envelopes
    FOR INSERT
    WITH CHECK (
        talent_id IN (
            SELECT id FROM talent_profiles WHERE user_id = auth.uid()
        )
    );


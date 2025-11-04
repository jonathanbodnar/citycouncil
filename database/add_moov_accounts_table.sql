-- Create table to store Moov accounts linked to app users/talent
-- Run in Supabase SQL editor or include in your deployment migrations

BEGIN;

CREATE TABLE IF NOT EXISTS moov_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Optional: if you store talent row IDs separately
  talent_id UUID REFERENCES talent_profiles(id) ON DELETE SET NULL,
  moov_account_id VARCHAR(255) NOT NULL,
  mode VARCHAR(32), -- e.g., 'sandbox' or 'production'
  display_name TEXT,
  profile_email TEXT,
  status VARCHAR(32), -- e.g., 'unverified','verified','restricted'
  raw_response JSONB, -- last known response snapshot for debugging (no sensitive data)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One Moov account per user (adjust if you need multiple)
CREATE UNIQUE INDEX IF NOT EXISTS idx_moov_accounts_user_id
  ON moov_accounts(user_id);

-- Ensure Moov account ID is unique
CREATE UNIQUE INDEX IF NOT EXISTS idx_moov_accounts_moov_account_id
  ON moov_accounts(moov_account_id);

-- Trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_moov_accounts_updated_at ON moov_accounts;
CREATE TRIGGER trg_moov_accounts_updated_at
  BEFORE UPDATE ON moov_accounts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE moov_accounts IS 'Stores Moov account linkage per app user/talent';
COMMENT ON COLUMN moov_accounts.moov_account_id IS 'Moov account ID returned by Moov API';

COMMIT;



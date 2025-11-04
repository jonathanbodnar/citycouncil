BEGIN;

ALTER TABLE talent_profiles
ADD COLUMN IF NOT EXISTS moov_account_id VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS idx_talent_profiles_moov_account_id
  ON talent_profiles (moov_account_id)
  WHERE moov_account_id IS NOT NULL;

COMMENT ON COLUMN talent_profiles.moov_account_id
  IS 'Moov account ID for this talent';

COMMIT;



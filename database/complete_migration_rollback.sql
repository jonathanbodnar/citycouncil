-- Complete Migration Rollback Script
-- Date: 2024-10-20
-- Description: Rollback both Fortis Pay and talent management features

\echo 'Rolling back complete ShoutOut platform migration...';

BEGIN;

-- ============================================================================
-- PART 1: REMOVE TRIGGERS
-- ============================================================================

\echo 'Removing triggers...';

DROP TRIGGER IF EXISTS update_payouts_updated_at ON payouts;
DROP TRIGGER IF EXISTS update_vendor_bank_info_updated_at ON vendor_bank_info;
DROP TRIGGER IF EXISTS update_platform_settings_updated_at ON platform_settings;

-- ============================================================================
-- PART 2: REMOVE TABLES (in reverse dependency order)
-- ============================================================================

\echo 'Removing tables...';

-- Remove talent management tables
DROP TABLE IF EXISTS platform_settings;

-- Remove Fortis Pay tables
DROP TABLE IF EXISTS vendor_bank_info;
DROP TABLE IF EXISTS payout_errors;
DROP TABLE IF EXISTS payouts;

-- ============================================================================
-- PART 3: REMOVE COLUMNS FROM EXISTING TABLES
-- ============================================================================

\echo 'Removing columns from talent_profiles...';

-- Remove Fortis Pay columns
ALTER TABLE talent_profiles DROP COLUMN IF EXISTS fortis_vendor_id;

-- Remove talent management columns
ALTER TABLE talent_profiles DROP COLUMN IF EXISTS username;
ALTER TABLE talent_profiles DROP COLUMN IF EXISTS onboarding_token;
ALTER TABLE talent_profiles DROP COLUMN IF EXISTS onboarding_completed;
ALTER TABLE talent_profiles DROP COLUMN IF EXISTS onboarding_expires_at;

-- ============================================================================
-- PART 4: REMOVE INDEXES
-- ============================================================================

\echo 'Removing indexes...';

-- Remove talent management indexes
DROP INDEX IF EXISTS idx_talent_profiles_username;
DROP INDEX IF EXISTS idx_talent_profiles_username_lower;
DROP INDEX IF EXISTS idx_talent_profiles_onboarding_token;

-- Remove Fortis Pay indexes (automatically removed with tables)

COMMIT;

\echo '';
\echo '✅ Complete migration rollback completed successfully!';
\echo '';
\echo 'All Fortis Pay and talent management features have been removed.';
\echo 'The database has been restored to its previous state.';
\echo '';
\echo 'Note: The update_updated_at_column() function was preserved';
\echo 'as it might be used by other parts of the system.';
\echo '';

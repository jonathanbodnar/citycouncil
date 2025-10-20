-- Rollback Migration: Remove Fortis Pay integration tables
-- Date: 2024-10-20
-- Description: Rollback script to remove all Fortis Pay related tables and columns

-- Drop triggers first
DROP TRIGGER IF EXISTS update_payouts_updated_at ON payouts;
DROP TRIGGER IF EXISTS update_vendor_bank_info_updated_at ON vendor_bank_info;

-- Drop tables (in reverse order of dependencies)
DROP TABLE IF EXISTS vendor_bank_info;
DROP TABLE IF EXISTS payout_errors;
DROP TABLE IF EXISTS payouts;

-- Remove column from talent_profiles
ALTER TABLE talent_profiles 
DROP COLUMN IF EXISTS fortis_vendor_id;

-- Note: We don't drop the update_updated_at_column function as it might be used by other tables

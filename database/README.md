# Database Setup for ShoutOut Platform

This directory contains the database migration scripts needed for the complete ShoutOut platform including Fortis Pay integration and talent management.

## Files

### Complete Migration (Recommended)
- `complete_migration.sql` - **Run this one** - Complete setup script
- `complete_migration_rollback.sql` - Complete rollback script

### Individual Migrations (if needed)
- `setup_fortis_tables.sql` - Fortis Pay only
- `migrations/001_add_fortis_tables.sql` - Fortis Pay migration
- `migrations/002_add_talent_management.sql` - Talent management migration
- `migrations/001_add_fortis_tables_rollback.sql` - Fortis rollback

## Quick Setup

### Option 1: Run the complete migration script (RECOMMENDED)

```bash
# Connect to your PostgreSQL database and run:
psql -d your_database_name -f database/complete_migration.sql
```

### Option 2: Copy and paste the SQL

1. Connect to your database
2. Copy the contents of `complete_migration.sql`
3. Paste and execute in your database client

### Option 3: Railway/Supabase Dashboard

1. Open your database dashboard
2. Go to the SQL editor
3. Copy and paste the contents of `complete_migration.sql`
4. Execute the script

## Tables Created

### Fortis Pay Integration

#### `payouts`
Tracks all payouts made to talent through Fortis Pay
- Links to talent and orders
- Tracks payout status and amounts
- Stores Fortis transaction IDs

#### `payout_errors` 
Logs failed payout attempts for manual review
- Captures error messages
- Tracks resolution status
- Allows admin to retry failed payouts

#### `vendor_bank_info`
Stores banking information for talent payouts
- One bank account per talent
- Verification status tracking
- Secure storage of banking details

### Talent Management

#### `platform_settings`
Stores platform-wide configuration settings
- Logo upload URLs
- Global admin settings
- Feature toggles and limits

### Modified Tables

#### `talent_profiles` (Enhanced)
- **Fortis Integration**: `fortis_vendor_id` for payout system
- **Username System**: `username` for custom URLs (shoutout.us/username)
- **Onboarding System**: `onboarding_token`, `onboarding_completed`, `onboarding_expires_at`

## Environment Variables Needed

Add these to your Railway/hosting environment:

```env
REACT_APP_FORTIS_API_KEY=your_api_key_here
REACT_APP_FORTIS_API_SECRET=your_api_secret_here
REACT_APP_FORTIS_ENV=sandbox  # or 'production'
REACT_APP_FORTIS_COMPANY_ID=862763
REACT_APP_FORTIS_PARTNER_ID=LunarPay
REACT_APP_FORTIS_MID=466210844885
```

## Verification

After running the setup script, verify the tables were created:

```sql
-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('payouts', 'payout_errors', 'vendor_bank_info');

-- Check if column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'talent_profiles' 
  AND column_name = 'fortis_vendor_id';
```

## Rollback

If you need to remove the Fortis integration:

```bash
psql -d your_database_name -f database/migrations/001_add_fortis_tables_rollback.sql
```

## Security Notes

- Bank account numbers are stored encrypted at rest (depending on your database configuration)
- Only the last 4 digits are shown in the UI
- Admin verification is required before payouts can be processed
- All payout attempts are logged for audit purposes

## Support

If you encounter any issues with the database setup:

1. Check that your existing `talent_profiles` and `orders` tables exist
2. Ensure your database user has CREATE TABLE permissions
3. Verify PostgreSQL version supports UUID generation (9.4+)
4. Check the error messages in the database logs

-- RLS Policies for Corporate Pricing Feature
-- CONSERVATIVE APPROACH: Only grant column-level permissions for corporate_pricing
-- Does NOT modify existing RLS policies to avoid breaking working functionality

-- Grant column-level UPDATE permission for corporate_pricing
-- This allows authenticated users to update ONLY corporate_pricing and updated_at columns
-- Existing UPDATE policies on talent_profiles will control WHO can update (talent/admin)
GRANT UPDATE (corporate_pricing, updated_at) ON talent_profiles TO authenticated;

-- Verify SELECT permission exists (should already be granted for anon/authenticated)
-- This is a safe check that won't break anything
DO $$
BEGIN
  -- Check if SELECT is already granted, if not grant it
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_privileges 
    WHERE table_schema = 'public' 
    AND table_name = 'talent_profiles' 
    AND privilege_type = 'SELECT' 
    AND grantee IN ('anon', 'authenticated')
  ) THEN
    GRANT SELECT ON talent_profiles TO anon, authenticated;
  END IF;
END $$;

-- Add helpful comment to corporate_pricing column
COMMENT ON COLUMN talent_profiles.corporate_pricing IS 'Corporate event ShoutOut pricing in dollars. NULL means not offering corporate events. Managed through BioDashboard.';

-- Display current grants for verification (read-only query, won't break anything)
SELECT 
  table_name,
  grantee,
  privilege_type
FROM information_schema.table_privileges 
WHERE table_schema = 'public' 
  AND table_name IN ('talent_profiles', 'orders')
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee, privilege_type;


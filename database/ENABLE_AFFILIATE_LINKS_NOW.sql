-- Enable Affiliate Links Feature
-- Run this in Supabase SQL Editor to add all required columns and policies

-- 1. Add affiliate link columns to bio_links table
ALTER TABLE bio_links ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE bio_links ADD COLUMN IF NOT EXISTS discount_amount TEXT;

-- 2. Add affiliate section title to bio_settings
ALTER TABLE bio_settings ADD COLUMN IF NOT EXISTS affiliate_section_title TEXT DEFAULT 'Back the Brands That Support Me';

-- 3. Add comments for documentation
COMMENT ON COLUMN bio_links.company_name IS 'Company/brand name for affiliate links';
COMMENT ON COLUMN bio_links.discount_amount IS 'Discount code or amount for affiliate links (e.g., "20% OFF" or "SAVE20")';
COMMENT ON COLUMN bio_settings.affiliate_section_title IS 'Custom title for the affiliate links carousel section';

-- 4. Check and update RLS policies for bio_links
-- Allow authenticated users to insert their own bio links
DO $$
BEGIN
  -- Drop existing insert policy if it exists
  DROP POLICY IF EXISTS "Users can insert own bio links" ON bio_links;
  
  -- Create comprehensive insert policy
  CREATE POLICY "Users can insert own bio links" ON bio_links
    FOR INSERT
    WITH CHECK (
      -- User must be authenticated
      auth.uid() IS NOT NULL
      AND
      -- The talent_id must match a talent profile owned by this user
      talent_id IN (
        SELECT id FROM talent_profiles WHERE user_id = auth.uid()
      )
    );
END $$;

-- 5. Verify columns were added
SELECT 
  'company_name' as column_name,
  EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name='bio_links' AND column_name='company_name'
  ) as exists;

SELECT 
  'discount_amount' as column_name,
  EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name='bio_links' AND column_name='discount_amount'
  ) as exists;

SELECT 
  'affiliate_section_title' as column_name,
  EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name='bio_settings' AND column_name='affiliate_section_title'
  ) as exists;

-- 6. Verify RLS policy exists
SELECT 
  'bio_links insert policy' as policy_check,
  EXISTS (
    SELECT FROM pg_policies 
    WHERE tablename = 'bio_links' 
    AND policyname = 'Users can insert own bio links'
  ) as exists;

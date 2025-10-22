-- Add corporate pricing toggle for talent profiles (Supabase compatible)
-- This allows admins to control which talents can offer business pricing

-- Add the corporate pricing toggle field
ALTER TABLE talent_profiles 
ADD COLUMN allow_corporate_pricing BOOLEAN DEFAULT FALSE;

-- Update existing talents to not allow corporate pricing by default
UPDATE talent_profiles 
SET allow_corporate_pricing = FALSE 
WHERE allow_corporate_pricing IS NULL;

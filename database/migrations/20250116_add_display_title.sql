-- Add display_title field for custom banner card titles
-- This allows talent to have a custom title/tagline on their banner card

ALTER TABLE talent_profiles
ADD COLUMN IF NOT EXISTS display_title TEXT;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- Verify
SELECT 
  'Column added successfully' as status,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'talent_profiles'
  AND column_name = 'display_title';

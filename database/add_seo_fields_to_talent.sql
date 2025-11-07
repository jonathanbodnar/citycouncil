-- Add SEO fields to talent_profiles for search engine optimization
-- This migration adds slug and keywords for better indexing

-- Add slug column (URL-friendly name)
ALTER TABLE talent_profiles 
ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- Add keywords array for SEO
ALTER TABLE talent_profiles 
ADD COLUMN IF NOT EXISTS keywords TEXT[] DEFAULT '{}';

-- Create index on slug for fast lookups
CREATE INDEX IF NOT EXISTS idx_talent_profiles_slug ON talent_profiles(slug);

-- Create GIN index on keywords for full-text search
CREATE INDEX IF NOT EXISTS idx_talent_profiles_keywords ON talent_profiles USING GIN(keywords);

-- Generate slugs for existing talent (from their full_name)
UPDATE talent_profiles 
SET slug = LOWER(REGEXP_REPLACE(TRIM(full_name), '[^a-zA-Z0-9\s-]', '', 'g'))
WHERE slug IS NULL OR slug = '';

UPDATE talent_profiles 
SET slug = REPLACE(slug, ' ', '-')
WHERE slug LIKE '% %';

-- Set default keywords based on category for existing talent
UPDATE talent_profiles 
SET keywords = ARRAY[
  full_name,
  category::TEXT,
  'video message',
  'personalized shoutout',
  CASE 
    WHEN category IN ('politician', 'candidate', 'commentator') THEN 'conservative voice'
    WHEN category = 'faith-leader' THEN 'faith-based'
    WHEN category = 'military' THEN 'patriotic'
    ELSE 'influencer'
  END
]
WHERE keywords = '{}' OR keywords IS NULL;

COMMENT ON COLUMN talent_profiles.slug IS 'URL-friendly unique identifier for SEO';
COMMENT ON COLUMN talent_profiles.keywords IS 'SEO keywords array for search optimization';


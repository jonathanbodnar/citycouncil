-- Fix link_type constraint to allow 'affiliate' type
-- The constraint is preventing affiliate links from being added

-- Drop the old constraint
ALTER TABLE bio_links DROP CONSTRAINT IF EXISTS bio_links_link_type_check;

-- Add new constraint with 'affiliate' included
ALTER TABLE bio_links ADD CONSTRAINT bio_links_link_type_check 
  CHECK (link_type IN ('basic', 'grid', 'newsletter', 'sponsor', 'video', 'affiliate'));

-- Verify the constraint was updated
SELECT 
  constraint_name, 
  check_clause 
FROM information_schema.check_constraints 
WHERE constraint_name = 'bio_links_link_type_check';

-- Delete the "Get weekly updates on shows" newsletter link for jonathanbodnar
-- Run this in Supabase SQL Editor

-- First, find the talent_id for jonathanbodnar
-- SELECT id, username, full_name FROM talent_profiles WHERE username = 'jonathanbodnar';

-- Delete any newsletter-type links for this user
DELETE FROM bio_links 
WHERE talent_id = (
  SELECT id FROM talent_profiles WHERE username = 'jonathanbodnar'
)
AND (
  link_type = 'newsletter'
  OR title ILIKE '%weekly updates%'
  OR title ILIKE '%newsletter%'
);

-- Verify deletion
SELECT * FROM bio_links 
WHERE talent_id = (
  SELECT id FROM talent_profiles WHERE username = 'jonathanbodnar'
)
ORDER BY display_order;


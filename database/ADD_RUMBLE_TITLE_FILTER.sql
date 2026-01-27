-- Add a column for filtering Rumble videos by title keywords
-- This is useful when a talent shares a channel (e.g., BonginoReport has multiple hosts)

ALTER TABLE public.talent_profiles
ADD COLUMN IF NOT EXISTS rumble_title_filter text;

-- Add a comment explaining the column
COMMENT ON COLUMN public.talent_profiles.rumble_title_filter IS 'Filter Rumble videos to only show ones with this text in the title (case-insensitive). Useful for shared channels.';

-- Set Hayley Caronia's filter to her name
UPDATE public.talent_profiles
SET rumble_title_filter = 'Hayley'
WHERE username = 'hayleycaronia';

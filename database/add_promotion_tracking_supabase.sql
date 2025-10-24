-- Add promotion tracking (Supabase compatible)

ALTER TABLE talent_profiles 
ADD COLUMN is_participating_in_promotion BOOLEAN DEFAULT FALSE,
ADD COLUMN promotion_claimed_at TIMESTAMP WITH TIME ZONE;

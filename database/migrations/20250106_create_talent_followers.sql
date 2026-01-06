-- Create talent_followers table to track users following talents
-- This enables talents to see their "followers" who are also ShoutOut users

CREATE TABLE IF NOT EXISTS talent_followers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  talent_id UUID NOT NULL REFERENCES talent_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Ensure a user can only follow a talent once
  UNIQUE(user_id, talent_id)
);

-- Enable RLS
ALTER TABLE talent_followers ENABLE ROW LEVEL SECURITY;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_talent_followers_talent_id ON talent_followers(talent_id);
CREATE INDEX IF NOT EXISTS idx_talent_followers_user_id ON talent_followers(user_id);

-- RLS Policies

-- Anyone can insert a follow (we'll create the user in the same transaction)
CREATE POLICY "Anyone can follow a talent" ON talent_followers
FOR INSERT TO anon, authenticated
WITH CHECK (true);

-- Talents can see their followers
CREATE POLICY "Talents can view their followers" ON talent_followers
FOR SELECT TO authenticated
USING (
  talent_id IN (
    SELECT id FROM talent_profiles WHERE user_id = auth.uid()
  )
);

-- Users can see who they follow
CREATE POLICY "Users can view their follows" ON talent_followers
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Users can unfollow
CREATE POLICY "Users can unfollow" ON talent_followers
FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- Also allow anon to select (for checking if already following)
CREATE POLICY "Anon can check follows" ON talent_followers
FOR SELECT TO anon
USING (true);

COMMENT ON TABLE talent_followers IS 'Tracks which users are following which talents for the bio page newsletter/follow feature';


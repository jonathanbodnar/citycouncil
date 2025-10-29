-- Social Media Tracking Tables

-- Table to track social media posts that tag ShoutOut
CREATE TABLE IF NOT EXISTS social_media_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  talent_id UUID NOT NULL REFERENCES talent_profiles(id) ON DELETE CASCADE,
  platform VARCHAR(50) NOT NULL, -- 'instagram', 'tiktok', 'twitter'
  post_id VARCHAR(255) NOT NULL, -- platform-specific post ID
  post_url TEXT,
  post_date TIMESTAMP WITH TIME ZONE NOT NULL,
  tag_detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  caption TEXT,
  engagement_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(platform, post_id)
);

-- Table to track bio/link tracking status
CREATE TABLE IF NOT EXISTS social_media_bio_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  talent_id UUID NOT NULL REFERENCES talent_profiles(id) ON DELETE CASCADE,
  platform VARCHAR(50) NOT NULL, -- 'instagram', 'tiktok', 'twitter'
  has_shoutout_link BOOLEAN DEFAULT FALSE,
  link_found TEXT, -- The actual link found in bio
  last_checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(talent_id, platform)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_social_media_tags_talent_id ON social_media_tags(talent_id);
CREATE INDEX IF NOT EXISTS idx_social_media_tags_platform ON social_media_tags(platform);
CREATE INDEX IF NOT EXISTS idx_social_media_tags_post_date ON social_media_tags(post_date);
CREATE INDEX IF NOT EXISTS idx_social_media_bio_tracking_talent_id ON social_media_bio_tracking(talent_id);

-- Add comments
COMMENT ON TABLE social_media_tags IS 'Tracks posts that tag ShoutOut on social media platforms';
COMMENT ON TABLE social_media_bio_tracking IS 'Tracks whether talent has ShoutOut link in their bio';
COMMENT ON COLUMN social_media_tags.platform IS 'Social media platform: instagram, tiktok, or twitter';
COMMENT ON COLUMN social_media_tags.post_id IS 'Platform-specific unique post identifier';
COMMENT ON COLUMN social_media_bio_tracking.has_shoutout_link IS 'Whether shoutout.us is found in bio/links';


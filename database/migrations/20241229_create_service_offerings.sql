-- Create service_offerings table for bio page services like Instagram Collab
CREATE TABLE IF NOT EXISTS service_offerings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_id UUID NOT NULL REFERENCES talent_profiles(id) ON DELETE CASCADE,
  
  -- Service type
  service_type VARCHAR(50) NOT NULL DEFAULT 'instagram_collab', -- 'instagram_collab', 'tiktok_collab', etc.
  
  -- Pricing
  pricing INTEGER NOT NULL, -- Price in cents
  
  -- Service details
  title VARCHAR(255) DEFAULT 'Collaborate with me',
  description TEXT,
  video_length_seconds INTEGER DEFAULT 60, -- Default 60 seconds
  
  -- What they get (stored as JSONB array)
  benefits JSONB DEFAULT '["Personalized video mention", "Story share to followers", "Permanent post on feed"]'::jsonb,
  
  -- Display settings
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one service type per talent
  UNIQUE(talent_id, service_type)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_service_offerings_talent_id ON service_offerings(talent_id);
CREATE INDEX IF NOT EXISTS idx_service_offerings_active ON service_offerings(is_active) WHERE is_active = true;

-- Add order_type to orders table to distinguish shoutouts from collabs
ALTER TABLE orders ADD COLUMN IF NOT EXISTS service_type VARCHAR(50) DEFAULT 'shoutout';

-- Add collab-specific fields to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS service_offering_id UUID REFERENCES service_offerings(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS suggested_script TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS target_audience TEXT;

-- Create index for filtering by service type
CREATE INDEX IF NOT EXISTS idx_orders_service_type ON orders(service_type);

-- Enable RLS
ALTER TABLE service_offerings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for service_offerings
-- Anyone can view active service offerings (for bio pages)
CREATE POLICY "Anyone can view active service offerings" ON service_offerings
  FOR SELECT USING (is_active = true);

-- Talents can manage their own service offerings
CREATE POLICY "Talents can manage their own service offerings" ON service_offerings
  FOR ALL USING (
    talent_id IN (
      SELECT id FROM talent_profiles WHERE user_id = auth.uid()
    )
  );

-- Admins can manage all service offerings
CREATE POLICY "Admins can manage all service offerings" ON service_offerings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

-- Grant permissions
GRANT SELECT ON service_offerings TO anon;
GRANT ALL ON service_offerings TO authenticated;

COMMENT ON TABLE service_offerings IS 'Service offerings for bio pages (Instagram Collab, TikTok Collab, etc.)';
COMMENT ON COLUMN service_offerings.service_type IS 'Type of service: instagram_collab, tiktok_collab, etc.';
COMMENT ON COLUMN service_offerings.benefits IS 'JSON array of benefit strings that describe what the customer gets';


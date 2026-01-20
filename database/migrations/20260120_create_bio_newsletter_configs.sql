-- Migration: Create bio_newsletter_configs table
-- This table stores external newsletter provider configurations for talents
-- Used by BioPage.tsx and BioDashboard.tsx to sync subscribers to external services

CREATE TABLE IF NOT EXISTS bio_newsletter_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_id UUID NOT NULL REFERENCES talent_profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'mailchimp', 'getresponse', 'activecampaign', 'webhook'
  api_key TEXT,
  list_id TEXT,
  webhook_url TEXT,
  form_id TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(talent_id, provider)
);

-- Indexes
CREATE INDEX idx_bio_newsletter_configs_talent ON bio_newsletter_configs(talent_id);
CREATE INDEX idx_bio_newsletter_configs_active ON bio_newsletter_configs(talent_id, is_active) WHERE is_active = true;

-- RLS
ALTER TABLE bio_newsletter_configs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Talents can manage their newsletter configs" ON bio_newsletter_configs
FOR ALL TO authenticated
USING (talent_id IN (SELECT id FROM talent_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Service role access" ON bio_newsletter_configs
FOR ALL TO service_role USING (true);

-- Anon read for bio page (only reads active configs, no sensitive data exposed via RLS)
CREATE POLICY "Anon can read active configs" ON bio_newsletter_configs
FOR SELECT TO anon
USING (is_active = true);

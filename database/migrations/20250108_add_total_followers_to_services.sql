-- Add total_followers to service_offerings - simple direct storage
ALTER TABLE service_offerings
ADD COLUMN IF NOT EXISTS total_followers INTEGER DEFAULT 0;


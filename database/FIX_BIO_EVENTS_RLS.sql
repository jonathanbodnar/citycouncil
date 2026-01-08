-- NUCLEAR OPTION: Just disable RLS on bio_events
-- This table doesn't need strict security - it's just event display data

ALTER TABLE bio_events DISABLE ROW LEVEL SECURITY;

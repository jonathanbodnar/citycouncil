-- Enable real-time for help_messages table
-- This needs to be run in Supabase SQL Editor

-- Enable real-time for the help_messages table
ALTER PUBLICATION supabase_realtime ADD TABLE help_messages;

-- Verify real-time is enabled
SELECT schemaname, tablename, pubname 
FROM pg_publication_tables 
WHERE tablename = 'help_messages';

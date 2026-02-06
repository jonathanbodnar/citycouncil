import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Client for public read operations
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client for write operations (scraping/caching)
// Uses service role key which bypasses RLS
export const supabaseAdmin = supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

// Database types
export interface DbMeeting {
  id: string;
  external_id: string;
  city_id: string;
  city_name: string;
  title: string;
  description: string | null;
  date: string;
  time: string;
  location: string | null;
  address: string | null;
  agenda_url: string | null;
  live_stream_url: string | null;
  meeting_type: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface DbCityCache {
  city_id: string;
  last_scraped: string;
  created_at: string;
}

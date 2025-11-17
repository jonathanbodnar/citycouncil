import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL!;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Fix for iPad/iOS Safari/Chrome "Login taking too long" error
    // Use localStorage instead of default (which can fail on iOS)
    storage: window.localStorage,
    storageKey: 'supabase.auth.token',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    // Increase flow timeout for slower connections/devices
    flowType: 'pkce', // More secure and works better with mobile
  },
  global: {
    headers: {
      'X-Client-Info': 'shoutout-web',
    },
  },
});

export default supabase;

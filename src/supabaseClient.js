import { createClient } from '@supabase/supabase-js';

// Read from CRA env at build time. Set these in Vercel's Project → Environment Variables
// for production, and in a local .env at the repo root for local dev.
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase env vars missing. Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY in your environment (.env at repo root for local dev, Vercel project settings for prod).'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

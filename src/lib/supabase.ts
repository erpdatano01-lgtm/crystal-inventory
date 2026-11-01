import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith('http') &&
  !supabaseUrl.includes('your_supabase_url') &&
  !supabaseUrl.includes('your-project') &&
  supabaseAnonKey !== 'your_supabase_anon_key'
);

function getClient() {
  if (!isSupabaseConfigured) return null;

  // If in Node.js server environment without browser WebSocket
  if (typeof window === 'undefined') {
    try {
      const ws = require('ws');
      return createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false },
        realtime: { transport: ws },
      });
    } catch {
      return createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false },
      });
    }
  }

  // In browser
  return createClient(supabaseUrl, supabaseAnonKey);
}

export const supabase = getClient();

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const isSupabaseAdminConfigured = Boolean(
  supabaseUrl &&
  serviceRoleKey &&
  supabaseUrl.startsWith('http') &&
  !supabaseUrl.includes('your_supabase_url') &&
  !serviceRoleKey.includes('your_supabase')
);

function getAdminClient() {
  if (!isSupabaseAdminConfigured) return null;

  try {
    const ws = require('ws');
    return createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
      realtime: { transport: ws },
    });
  } catch {
    return createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });
  }
}

export const supabaseAdmin = getAdminClient();

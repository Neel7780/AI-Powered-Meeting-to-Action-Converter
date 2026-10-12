import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  rawUrl &&
  rawAnonKey &&
  rawUrl !== 'https://your-project-id.supabase.co' &&
  !rawUrl.includes('placeholder')
);

if (!isSupabaseConfigured) {
  console.warn(
    '[ActionPulse] Supabase URL or Anon Key is missing or using placeholder. ' +
    'Provide VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment variables to enable authentication and database features.'
  );
}

// Safe fallback placeholder to prevent app crash when environment variables are not yet configured on deployment
const effectiveUrl = isSupabaseConfigured && rawUrl ? rawUrl : 'https://placeholder.supabase.co';
const effectiveKey = isSupabaseConfigured && rawAnonKey ? rawAnonKey : 'placeholder-anon-key';

export const supabase = createClient(effectiveUrl, effectiveKey);

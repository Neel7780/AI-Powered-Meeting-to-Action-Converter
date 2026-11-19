import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Guard: detect if a service-role key was accidentally used as the anon key.
// A service-role JWT contains "role":"service_role"; anon keys contain "role":"anon".
// Using a service-role key on the client bypasses ALL Row-Level Security policies
// and exposes the entire database to any user who opens DevTools.
if (rawAnonKey && rawAnonKey.startsWith('eyJ')) {
  try {
    const payload = JSON.parse(atob(rawAnonKey.split('.')[1]));
    if (payload?.role === 'service_role') {
      console.error(
        '[ActionPulse] 🚨 SECURITY: VITE_SUPABASE_ANON_KEY is set to the service_role key. ' +
        'This bypasses Row-Level Security and exposes your database. ' +
        'Replace it with the "anon public" key from Supabase Dashboard → Settings → API.'
      );
    }
  } catch {
    // ignore malformed JWT — Supabase will reject it anyway
  }
}

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

export const supabase = createClient(effectiveUrl, effectiveKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
});

/**
 * ActionPulse API Base URL Client Configuration
 * 
 * Deployment Strategy:
 * - Frontend: Vite SPA hosted on Vercel.
 * - Backend: Containerized FastAPI web service on Render/Railway (supporting LangChain/LangGraph long-running runs).
 * 
 * Request Routing:
 * 1. If VITE_API_BASE_URL is configured (e.g. 'https://actionpulse-backend.onrender.com'),
 *    API requests are sent directly to that origin.
 * 2. If VITE_API_BASE_URL is omitted or empty (''), requests use relative paths ('/api/...'),
 *    which vercel.json rewrites forward to the backend service.
 * 3. In local development without Vercel, vite.config.ts proxies '/api' to 'http://localhost:8000'.
 */
import { isSupabaseConfigured, supabase } from './supabase';

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

/**
 * Helper to build full API endpoint URL.
 */
export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
}

/** Authenticated JSON requests, shared by external integration settings. */
export async function requestApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!isSupabaseConfigured) throw new Error('Authentication is not configured.');
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!session?.access_token) throw new Error('Your session has expired. Please sign in.');
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`);
  const res = await fetch(getApiUrl(path), { cache: 'no-store', ...options, headers });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => {
    throw new Error(res.ok ? 'Backend returned an unreadable response.' : `HTTP ${res.status}`);
  });
  if (!res.ok) {
    throw new Error(typeof data.detail === 'string' ? data.detail : `HTTP ${res.status}`);
  }
  return data as T;
}

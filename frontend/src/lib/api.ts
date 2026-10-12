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
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

/**
 * Helper to build full API endpoint URL.
 */
export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
}

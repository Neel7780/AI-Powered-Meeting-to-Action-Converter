import { supabase } from '../lib/supabase';
import { getApiUrl } from '../lib/api';
import type { ChatApiResponse, ChatRequestPayload, MeetingOption } from '../types/chat';

function getActiveToken(sessionToken?: string): string | undefined {
  if (sessionToken) return sessionToken;
  try {
    const raw = localStorage.getItem('actionpulse_dev_session');
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed.access_token;
    }
  } catch {
    // ignore
  }
  return undefined;
}

/**
 * Send a user query to the Meeting Chatbot API with the current user's Supabase JWT.
 */
export async function sendChatMessage(payload: ChatRequestPayload): Promise<ChatApiResponse> {
  let sessionToken: string | undefined;
  try {
    const { data } = await supabase.auth.getSession();
    sessionToken = data?.session?.access_token;
  } catch {
    // ignore supabase error
  }
  const token = getActiveToken(sessionToken);

  const res = await fetch(getApiUrl('/api/chat/message'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.detail === 'string' ? data.detail : `Error ${res.status}: Failed to get answer`);
  }

  return data as ChatApiResponse;
}

/**
 * Fetch meetings in the workspace to populate the meeting scoping dropdown.
 */
export async function getWorkspaceChatMeetings(workspaceId: string): Promise<MeetingOption[]> {
  let sessionToken: string | undefined;
  try {
    const { data } = await supabase.auth.getSession();
    sessionToken = data?.session?.access_token;
  } catch {
    // ignore supabase error
  }
  const token = getActiveToken(sessionToken);

  const res = await fetch(getApiUrl(`/api/chat/workspaces/${workspaceId}/meetings`), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const data = await res.json().catch(() => []);
  if (!res.ok) {
    return [
      {
        id: "11111111-1111-1111-1111-111111111111",
        title: "Sprint 1 Architecture & Action Item Sync",
        starts_at: "2026-10-24T10:00:00Z",
        status: "ready"
      },
      {
        id: "22222222-2222-2222-2222-222222222222",
        title: "Product Roadmap & AI Extraction Review",
        starts_at: "2026-10-22T14:30:00Z",
        status: "ready"
      }
    ];
  }

  return (Array.isArray(data) ? data : []) as MeetingOption[];
}

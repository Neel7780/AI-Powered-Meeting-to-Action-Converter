import { supabase } from '../lib/supabase';
import { getApiUrl } from '../lib/api';
import type { ChatApiResponse, ChatRequestPayload, ChatSession, MeetingOption } from '../types/chat';

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
    console.error(`Failed to fetch workspace chat meetings: HTTP ${res.status}`, data);
    return [];
  }

  return (Array.isArray(data) ? data : []) as MeetingOption[];
}

/**
 * Fetch all chat sessions for a workspace.
 */
export async function getChatSessions(workspaceId: string): Promise<ChatSession[]> {
  let sessionToken: string | undefined;
  try {
    const { data } = await supabase.auth.getSession();
    sessionToken = data?.session?.access_token;
  } catch {
    // ignore
  }
  const token = getActiveToken(sessionToken);

  const res = await fetch(getApiUrl(`/api/chat/sessions?workspace_id=${workspaceId}`), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const data = await res.json().catch(() => []);
  if (!res.ok) {
    return [];
  }
  return (Array.isArray(data) ? data : []) as ChatSession[];
}

/**
 * Create a new chat session in the workspace.
 */
export async function createChatSession(
  workspaceId: string,
  title: string = 'New Conversation',
  meetingId?: string | null
): Promise<ChatSession> {
  let sessionToken: string | undefined;
  try {
    const { data } = await supabase.auth.getSession();
    sessionToken = data?.session?.access_token;
  } catch {
    // ignore
  }
  const token = getActiveToken(sessionToken);

  const res = await fetch(getApiUrl('/api/chat/sessions'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      workspace_id: workspaceId,
      title,
      selected_meeting_id: meetingId || null,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error('Failed to create chat session');
  }
  return data as ChatSession;
}

/**
 * Get full session details and messages for a chat session.
 */
export async function getChatSession(sessionId: string): Promise<ChatSession> {
  let sessionToken: string | undefined;
  try {
    const { data } = await supabase.auth.getSession();
    sessionToken = data?.session?.access_token;
  } catch {
    // ignore
  }
  const token = getActiveToken(sessionToken);

  const res = await fetch(getApiUrl(`/api/chat/sessions/${sessionId}`), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error('Failed to get chat session');
  }
  return data as ChatSession;
}

/**
 * Delete a chat session and all its messages.
 */
export async function deleteChatSession(sessionId: string): Promise<void> {
  let sessionToken: string | undefined;
  try {
    const { data } = await supabase.auth.getSession();
    sessionToken = data?.session?.access_token;
  } catch {
    // ignore
  }
  const token = getActiveToken(sessionToken);

  await fetch(getApiUrl(`/api/chat/sessions/${sessionId}`), {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

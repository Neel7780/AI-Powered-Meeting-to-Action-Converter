import { supabase } from '../lib/supabase';
import { getApiUrl } from '../lib/api';

export interface TaskCommunicationUser {
  id: string;
  display_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
}

export interface TaskCommunicationItem {
  id: string;
  task_id: string;
  workspace_id: string;
  sender_id: string;
  recipient_id: string;
  message_type: 'inquiry' | 'reply' | 'resolution';
  content: string;
  suggested_prerequisite_task_id?: string | null;
  suggested_prerequisite_task_title?: string | null;
  status: 'open' | 'answered' | 'resolved';
  created_at: string;
  updated_at: string;
  sender?: TaskCommunicationUser | null;
  recipient?: TaskCommunicationUser | null;
}

export async function fetchTaskCommunications(
  workspaceId: string,
  taskId: string
): Promise<TaskCommunicationItem[]> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(getApiUrl(`/api/workspaces/${workspaceId}/tasks/${taskId}/communications`), {
    method: 'GET',
    headers: {
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `Failed to fetch communications (${res.status})`);
  }
  return res.json();
}

export async function submitPrerequisiteInquiry(
  workspaceId: string,
  taskId: string,
  content: string
): Promise<TaskCommunicationItem> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(getApiUrl(`/api/workspaces/${workspaceId}/tasks/${taskId}/prerequisite-inquiries`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify({ content }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || `Failed to submit inquiry (${res.status})`);
  }
  return data;
}

export async function submitPrerequisiteReply(
  workspaceId: string,
  taskId: string,
  payload: {
    content: string;
    suggested_prerequisite_task_id?: string | null;
    mark_as_resolved?: boolean;
  }
): Promise<TaskCommunicationItem> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(getApiUrl(`/api/workspaces/${workspaceId}/tasks/${taskId}/prerequisite-replies`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || `Failed to submit reply (${res.status})`);
  }
  return data;
}

export async function resolvePrerequisiteInquiry(
  workspaceId: string,
  taskId: string,
  inquiryId: string
): Promise<TaskCommunicationItem> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(getApiUrl(`/api/workspaces/${workspaceId}/tasks/${taskId}/prerequisite-inquiries/${inquiryId}/resolve`), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify({}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || `Failed to resolve inquiry (${res.status})`);
  }
  return data;
}


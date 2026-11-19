import { requestApi } from '../lib/api';
import type { ChatApiResponse, ChatRequestPayload, MeetingOption } from '../types/chat';
export const sendChatMessage = (payload: ChatRequestPayload) => requestApi<ChatApiResponse>('/api/chat/message', { method: 'POST', body: JSON.stringify(payload) });
export const getWorkspaceChatMeetings = (workspaceId: string) => requestApi<MeetingOption[]>(`/api/chat/workspaces/${workspaceId}/meetings`);

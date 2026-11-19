import { requestApi } from '../lib/api';
import type { SprintVelocityData } from '../types/velocity';
export function fetchSprintVelocity(workspaceId: string, baseMeetingId?: string, currentMeetingId?: string): Promise<SprintVelocityData> {
  const params = new URLSearchParams();
  if (baseMeetingId) params.set('base_meeting_id', baseMeetingId);
  if (currentMeetingId) params.set('current_meeting_id', currentMeetingId);
  return requestApi(`/api/workspaces/${workspaceId}/velocity?${params}`);
}
export async function rolloverTaskToMeeting(workspaceId: string, taskId: string, targetMeetingId: string): Promise<boolean> {
  await requestApi(`/api/workspaces/${workspaceId}/tasks/${taskId}/rollover`, { method: 'POST', body: JSON.stringify({ target_meeting_id: targetMeetingId }) });
  return true;
}

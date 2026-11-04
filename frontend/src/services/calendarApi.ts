import { requestApi } from '../lib/api';

export interface CalendarAttendee {
  email: string;
  name?: string | null;
  matched_user_id?: string | null;
  is_workspace_member: boolean;
}

export interface CalendarEventItem {
  id: string;
  title: string;
  description?: string | null;
  starts_at: string;
  ends_at?: string | null;
  timezone: string;
  conference_url?: string | null;
  attendees: CalendarAttendee[];
  already_imported: boolean;
  existing_meeting_id?: string | null;
}

export interface CalendarStatus {
  connected: boolean;
  provider?: string | null;
  account_email?: string | null;
  last_synced_at?: string | null;
}

/** Get Google OAuth authorization URL */
export async function getCalendarConnectUrl(workspaceId: string, redirectUri?: string): Promise<string> {
  const params = new URLSearchParams({ workspace_id: workspaceId });
  if (redirectUri) params.set('redirect_uri', redirectUri);
  const data = await requestApi<{ auth_url: string }>(`/api/calendar/connect-url?${params.toString()}`);
  return data.auth_url;
}

/** Complete Google OAuth code exchange */
export async function handleCalendarCallback(code: string, state: string, redirectUri?: string) {
  return requestApi<{ success: boolean; account_email: string; workspace_id: string }>(
    '/api/calendar/callback',
    {
      method: 'POST',
      body: JSON.stringify({ code, state, redirect_uri: redirectUri }),
    }
  );
}

/** Get current calendar connection status */
export async function getCalendarStatus(workspaceId: string): Promise<CalendarStatus> {
  const params = new URLSearchParams({ workspace_id: workspaceId });
  return requestApi<CalendarStatus>(`/api/calendar/status?${params.toString()}`);
}

/** Disconnect calendar connection */
export async function disconnectCalendar(workspaceId: string) {
  const params = new URLSearchParams({ workspace_id: workspaceId });
  return requestApi<{ success: boolean }>(`/api/calendar/disconnect?${params.toString()}`, {
    method: 'DELETE',
  });
}

/** Fetch upcoming events with attendee matching and ActionPulse linkage */
export async function getUpcomingCalendarEvents(
  workspaceId: string,
  daysAhead: number = 14
): Promise<{ events: CalendarEventItem[]; synced_at: string }> {
  const params = new URLSearchParams({
    workspace_id: workspaceId,
    days_ahead: daysAhead.toString(),
  });
  return requestApi<{ events: CalendarEventItem[]; synced_at: string }>(
    `/api/calendar/events?${params.toString()}`
  );
}

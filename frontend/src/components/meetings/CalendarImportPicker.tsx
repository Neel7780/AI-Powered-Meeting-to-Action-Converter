import { useEffect, useState } from 'react';
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  ExternalLink,
  Link2,
  Loader2,
  RefreshCw,
  Video,
} from 'lucide-react';
import {
  disconnectCalendar,
  getCalendarConnectUrl,
  getCalendarStatus,
  getUpcomingCalendarEvents,
  type CalendarEventItem,
  type CalendarStatus,
} from '../../services/calendarApi';
import { Button } from '../ui/button';

interface CalendarImportPickerProps {
  workspaceId: string;
  onSelectEvent: (event: CalendarEventItem) => void;
  selectedEventId?: string;
}

export function CalendarImportPicker({
  workspaceId,
  onSelectEvent,
  selectedEventId,
}: CalendarImportPickerProps) {
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [events, setEvents] = useState<CalendarEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatusAndEvents = async () => {
    if (!workspaceId) return;
    try {
      setError(null);
      const st = await getCalendarStatus(workspaceId);
      setStatus(st);
      if (st.connected) {
        const { events: evList } = await getUpcomingCalendarEvents(workspaceId);
        setEvents(evList);
      } else {
        setEvents([]);
      }
    } catch (err: any) {
      console.warn('[ActionPulse] Calendar fetch note:', err.message);
      // If endpoint is unreachable or not yet configured, fail gracefully
      setStatus({ connected: false });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchStatusAndEvents();
  }, [workspaceId]);

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    try {
      const redirectUri = `${window.location.origin}/calendar/callback`;
      const authUrl = await getCalendarConnectUrl(workspaceId, redirectUri);
      // Redirect to Google consent screen
      window.location.href = authUrl;
    } catch (err: any) {
      setError(err.message || 'Failed to initialize Google OAuth');
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Google Calendar?')) return;
    try {
      await disconnectCalendar(workspaceId);
      await fetchStatusAndEvents();
    } catch (err: any) {
      setError(err.message || 'Failed to disconnect');
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchStatusAndEvents();
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] p-4 text-xs text-neutral-400">
        <Loader2 className="size-4 animate-spin text-indigo-400" />
        Checking calendar integration...
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/[0.03] p-4 text-neutral-300">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-md bg-indigo-500/10 text-indigo-400">
            <CalendarIcon className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-white">Google Calendar Sync</h3>
            <p className="text-xs text-neutral-400">
              {status?.connected
                ? `Connected as ${status.account_email}`
                : 'Import upcoming meetings and auto-fill details in 1 click'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {status?.connected ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
                className="h-8 gap-1.5 text-xs text-neutral-300 hover:text-white"
              >
                <RefreshCw className={`size-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDisconnect}
                className="h-8 text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300"
              >
                Disconnect
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              onClick={handleConnect}
              disabled={connecting}
              className="h-8 gap-1.5 bg-indigo-600 text-xs font-medium text-white hover:bg-indigo-500"
            >
              {connecting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Link2 className="size-3.5" />
              )}
              Connect Google Calendar
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-3 rounded border border-red-500/25 bg-red-500/10 p-2.5 text-xs text-red-300">
          {error}
        </div>
      )}

      {status?.connected && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">
              Upcoming Schedule ({events.length})
            </span>
          </div>

          {events.length === 0 ? (
            <p className="py-2 text-xs text-neutral-400">
              No upcoming events found on your Google Calendar in the next 14 days.
            </p>
          ) : (
            <div className="max-h-60 space-y-1.5 overflow-y-auto pr-1">
              {events.map((ev) => {
                const isSelected = selectedEventId === ev.id;
                const formattedDate = new Date(ev.starts_at).toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={ev.id}
                    className={`flex items-center justify-between gap-3 rounded-md border p-2.5 transition ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-500/15'
                        : 'border-white/5 bg-neutral-900/50 hover:border-white/15'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-xs font-medium text-white">
                          {ev.title}
                        </span>
                        {ev.conference_url && (
                          <span
                            title="Video conference link detected"
                            className="inline-flex items-center gap-1 rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] text-indigo-300"
                          >
                            <Video className="size-2.5" /> Meet
                          </span>
                        )}
                        {ev.already_imported && (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-300">
                            <CheckCircle2 className="size-2.5" /> ActionPulse Meeting
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-neutral-400">
                        <span>{formattedDate}</span>
                        <span>&bull;</span>
                        <span>{ev.attendees.length} participants</span>
                      </div>
                    </div>

                    <div>
                      {ev.already_imported ? (
                        <a
                          href={`/meetings/${ev.existing_meeting_id}/review`}
                          className="inline-flex items-center gap-1 text-[11px] text-indigo-400 hover:underline"
                        >
                          View <ExternalLink className="size-3" />
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onSelectEvent(ev)}
                          className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                            isSelected
                              ? 'bg-indigo-600 text-white'
                              : 'bg-white/10 text-neutral-200 hover:bg-white/20 hover:text-white'
                          }`}
                        >
                          {isSelected ? 'Selected' : 'Use Event'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

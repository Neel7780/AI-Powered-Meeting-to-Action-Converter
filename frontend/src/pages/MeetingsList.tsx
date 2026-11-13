import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '../context/WorkspaceContext';
import { useMeetings } from '../hooks/useMeetings';

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  processing: 'bg-blue-100 text-blue-700',
  ready: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
  archived: 'bg-slate-100 text-slate-500',
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-600';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${cls}`}>
      {status}
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr>
      {[1, 2, 3, 4].map((i) => (
        <td key={i} className="px-6 py-4">
          <div className="h-4 w-full animate-pulse rounded bg-slate-200" />
        </td>
      ))}
    </tr>
  );
}

function formatDate(isoString: string): string {
  if (!isoString) return '—';
  try {
    return new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(isoString));
  } catch {
    return isoString;
  }
}

export default function MeetingsList() {
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const { meetings, loading, error, refresh } = useMeetings(currentWorkspace?.id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-indigo-600">Workspace</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Meetings
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            All active meetings in this workspace.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={refresh}
            className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            ↻ Refresh
          </button>
          <button
            type="button"
            onClick={() => navigate('/meetings')}
            className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            + Create Meeting
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load meetings: {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              {['Title', 'Date & Time', 'Timezone', 'Status'].map((h) => (
                <th
                  key={h}
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
            ) : meetings.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-16 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50">
                    <span className="text-2xl">📅</span>
                  </div>
                  <p className="mt-4 font-semibold text-slate-900">No meetings yet.</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Create your first meeting to get started!
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate('/meetings')}
                    className="mt-4 inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                  >
                    + Create Meeting
                  </button>
                </td>
              </tr>
            ) : (
              meetings.map((meeting) => (
                <tr
                  key={meeting.id}
                  className="cursor-pointer transition hover:bg-slate-50"
                  onClick={() => navigate(`/meetings/${meeting.id}`)}
                >
                  <td className="px-6 py-4">
                    <p className="text-sm font-semibold text-slate-900">{meeting.title}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {formatDate(meeting.starts_at)}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {meeting.timezone || '—'}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={meeting.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

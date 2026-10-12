import { useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { TimezoneSelector } from '../components/meetings/TimezoneSelector';
import { TranscriptUploadModal } from '../components/meetings/TranscriptUploadModal';

export function CreateMeeting() {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [timezone, setTimezone] = useState('');
  const [participants, setParticipants] = useState<string>('');
  
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  const [meetingId] = useState(() => crypto.randomUUID());

  const handleUploadSuccess = (path: string) => {
    console.log('Transcript uploaded to:', path);
    // You could update state here to show completion or enable form submission
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Create Meeting</h1>
        <p className="mt-2 text-sm text-slate-500">
          Schedule a new meeting and upload transcripts to generate actionable insights.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-6">
          <div className="space-y-1.5">
            <label htmlFor="title" className="text-sm font-semibold text-slate-700">
              Meeting Title
            </label>
            <input
              id="title"
              type="text"
              placeholder="e.g. Q3 Roadmap Planning"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label htmlFor="date" className="text-sm font-semibold text-slate-700">
                Date & Time
              </label>
              <input
                id="date"
                type="datetime-local"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <TimezoneSelector 
              value={timezone} 
              onChange={setTimezone} 
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="participants" className="text-sm font-semibold text-slate-700">
              Participants (comma-separated tags)
            </label>
            <input
              id="participants"
              type="text"
              placeholder="e.g. alice@example.com, bob@example.com"
              value={participants}
              onChange={(e) => setParticipants(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Ingest Transcript</h2>
          <p className="mt-1 text-sm text-slate-500">
            Upload meeting audio transcripts (.txt, .vtt, .srt, .docx) to extract action items.
          </p>
        </div>
        <TranscriptUploadModal 
          workspaceId={workspaceId}
          meetingId={meetingId}
          onUploadSuccess={handleUploadSuccess}
        />
      </div>
    </div>
  );
}

export default CreateMeeting;

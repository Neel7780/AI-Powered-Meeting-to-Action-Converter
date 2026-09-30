import React, { useState } from 'react';
import { TimezoneSelector } from '../components/meetings/TimezoneSelector';
import { TranscriptUploadModal } from '../components/meetings/TranscriptUploadModal';

export function CreateMeeting() {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [timezone, setTimezone] = useState('');
  const [participants, setParticipants] = useState<string>('');
  
  // For demo purposes, simulating workspace/meeting IDs
  const workspaceId = 'default-workspace';
  const meetingId = `mtg_${Date.now()}`;

  const handleUploadSuccess = (path: string) => {
    console.log('Transcript uploaded to:', path);
    // You could update state here to show completion or enable form submission
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create Meeting</h1>
          <p className="text-muted-foreground mt-2">
            Schedule a new meeting and upload transcripts to generate actionable insights.
          </p>
        </div>

        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <div className="space-y-6">
            <div className="space-y-1.5">
              <label htmlFor="title" className="text-sm font-medium">
                Meeting Title
              </label>
              <input
                id="title"
                type="text"
                placeholder="e.g. Q3 Roadmap Planning"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="flex h-10 w-full rounded-md border border-border bg-input px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label htmlFor="date" className="text-sm font-medium">
                  Date & Time
                </label>
                <input
                  id="date"
                  type="datetime-local"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-border bg-input px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [color-scheme:dark]"
                />
              </div>

              <TimezoneSelector 
                value={timezone} 
                onChange={setTimezone} 
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="participants" className="text-sm font-medium">
                Participants (comma-separated tags)
              </label>
              <input
                id="participants"
                type="text"
                placeholder="e.g. alice@example.com, bob@example.com"
                value={participants}
                onChange={(e) => setParticipants(e.target.value)}
                className="flex h-10 w-full rounded-md border border-border bg-input px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">Ingest Transcript</h2>
          <TranscriptUploadModal 
            workspaceId={workspaceId}
            meetingId={meetingId}
            onUploadSuccess={handleUploadSuccess}
          />
        </div>
      </div>
    </div>
  );
}

export default CreateMeeting;

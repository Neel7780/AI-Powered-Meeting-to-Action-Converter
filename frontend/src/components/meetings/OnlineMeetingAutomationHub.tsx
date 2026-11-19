export function OnlineMeetingAutomationHub(_props: { workspaceId: string; onMeetingCreated?: (...args: any[]) => void }) {
  return <section className="rounded-xl border border-white/10 p-6 space-y-3">
    <h2 className="font-semibold">Online transcript ingestion</h2>
    <p>Google Meet, Zoom, and Teams transcript ingestion is unavailable. Create a meeting and upload or paste your transcript.</p>
    <p>Google Calendar event import is available through Calendar settings. It does not import transcripts.</p>
  </section>;
}

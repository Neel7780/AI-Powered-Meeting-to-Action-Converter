import { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import { useMeetingResource } from '../../hooks/useMeetingResource';
import { reviewApi, postApi } from '../../services/reviewApi';
import type { MeetingEntry } from '../../services/meetingNavigation';
import type { MeetingChapter, MeetingSummaryData } from '../../types/meetingDetails';
import type { TranscriptSegment } from '../../types/review';
import { MeetingChaptersTab } from './details/MeetingChaptersTab';
import { MeetingChaptersTranscriptSplitView } from './details/MeetingChaptersTranscriptSplitView';
import { MeetingSummaryTab } from './details/MeetingSummaryTab';
import { MeetingTranscriptTab } from './details/MeetingTranscriptTab';
import { TranscriptUploadModal } from './TranscriptUploadModal';
import { Button } from '../ui/button';

export function MeetingPreparation({ title, description }: { title: string; description: string }) {
  return (
    <section role="status" className="dashboard-surface rounded-xl border border-white/10 p-6 sm:p-8">
      <div className="flex items-start gap-4">
        <div aria-hidden="true" className="relative grid size-12 shrink-0 place-items-center rounded-xl bg-indigo-500/10 text-indigo-300">
          <div className="absolute inset-1 rounded-lg border border-indigo-400/20 motion-safe:animate-pulse" />
          <FileText className="size-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <p className="mt-1 max-w-lg text-sm leading-relaxed text-neutral-400">{description}</p>
        </div>
      </div>
      <div aria-hidden="true" className="ml-16 mt-5 max-w-md space-y-2.5 motion-safe:animate-pulse">
        <div className="h-2 w-4/5 rounded-full bg-white/10" />
        <div className="h-2 w-3/5 rounded-full bg-white/10" />
        <div className="h-2 w-2/5 rounded-full bg-white/10" />
      </div>
    </section>
  );
}

export function MeetingSummary({ summary, error, meeting, onTimestamp, onRetry }: {
  summary?: MeetingSummaryData; error?: string; meeting: MeetingEntry;
  onTimestamp: (timestamp: string) => void; onRetry: () => void;
}) {
  if (summary) return (
    <section className="overflow-hidden rounded-xl border border-white/10">
      <MeetingSummaryTab summary={summary} candidates={[]} onSelectTimestamp={onTimestamp} onJumpToCandidate={() => undefined} />
    </section>
  );
  return (
    <section className="space-y-3 rounded-xl border border-white/10 p-5">
      <h3 className="text-sm font-semibold">Meeting summary</h3>
      {error ? (
        <div className="flex flex-wrap items-center gap-3" role="alert">
          <p className="text-sm text-neutral-400">Could not load the meeting summary.</p>
          <Button variant="outline" size="sm" onClick={onRetry}>Retry summary</Button>
        </div>
      ) : <p className="text-sm text-neutral-400">{meeting.needsSpeakers ? 'Map speakers to prepare the summary.' : 'Add a transcript to see a summary here.'}</p>}
      {meeting.decisions.length > 0 && <div className="space-y-2">
        <h4 className="text-sm font-medium">Decisions</h4>
        <ul className="space-y-2 text-sm text-neutral-300">
          {meeting.decisions.map((decision) => <li key={decision.id}>{decision.task || decision.source_excerpt}</li>)}
        </ul>
      </div>}
    </section>
  );
}

function useChapters(meetingId: string, enabled: boolean, transcriptId?: string) {
  return useMeetingResource<{ chapters: MeetingChapter[] }>(`/api/meetings/${meetingId}/chapters`, enabled, transcriptId);
}

export function MeetingChapters({ meetingId, transcriptId, onTimestamp }: {
  meetingId: string; transcriptId: string; onTimestamp: (timestamp: string) => void;
}) {
  const { data, error, retry } = useChapters(meetingId, true, transcriptId);
  if (error) return (
    <div className="flex flex-wrap items-center gap-3" role="alert">
      <p className="text-sm text-neutral-400">Could not load the meeting chapters.</p>
      <Button variant="outline" size="sm" onClick={retry}>Retry chapters</Button>
    </div>
  );
  if (!data) return <MeetingPreparation title="Preparing chapters" description="Finding topics and linking them to the transcript." />;
  if (!data.chapters.length) return <p className="text-sm text-neutral-400">No chapters are available for this meeting.</p>;
  return <MeetingChaptersTab chapters={data.chapters} playbackSeconds={-1}
    onSelectChapter={(chapter) => onTimestamp(chapter.timestamp)} onNavigateToTranscript={onTimestamp} />;
}

export function MeetingTranscript({ meeting, canManage, timestamp, excerpt, onBackToReview, onRefresh, onTab }: {
  meeting: MeetingEntry; canManage: boolean; timestamp: string | null; excerpt?: string;
  onBackToReview?: () => void; onRefresh: () => Promise<void>; onTab: (tab: 'speakers') => void;
}) {
  const [segments, setSegments] = useState<TranscriptSegment[]>();
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [seek, setSeek] = useState<number | null>(null);
  const [showChapters, setShowChapters] = useState(false);
  const transcriptId = meeting.transcripts?.id;
  const chapterResource = useChapters(meeting.id, showChapters && !!transcriptId && meeting.status !== 'processing', transcriptId);
  const chapters = chapterResource.data?.chapters;
  const canUpload = canManage && ['draft', 'failed'].includes(meeting.status) && !transcriptId;
  const canExtract = canManage && meeting.ai_processing && !!transcriptId && !meeting.needsSpeakers
    && ['draft', 'failed'].includes(meeting.status);

  useEffect(() => {
    if (!transcriptId) return;
    let current = true;
    reviewApi.fetchTranscript(meeting.id).then(
      (data) => { if (current) setSegments(data); },
      (error: Error) => { if (current) setLoadError(error.message); },
    );
    return () => { current = false; };
  }, [meeting.id, transcriptId]);

  const extract = async () => {
    setExtracting(true);
    setActionError('');
    try { await postApi(`/api/meetings/${meeting.id}/extract`, {}); }
    catch (error) { setActionError((error as Error).message); }
    finally { await onRefresh(); setExtracting(false); }
  };

  const normalize = (text: string) => text.replace(/\s+/g, ' ').trim().toLowerCase();
  const sourceText = excerpt && normalize(excerpt);
  const sourceSegment = sourceText && (
    segments?.find((segment) => normalize(segment.text).includes(sourceText)) ??
    segments?.find((segment) => {
      const text = normalize(segment.text);
      return text.length >= 16 && sourceText.includes(text);
    })
  );
  const selectedSegment = seek === null ? undefined : segments?.find((segment) => segment.start_seconds === seek);
  const highlightedSegmentId = selectedSegment?.id || (sourceSegment ? sourceSegment.id : undefined);

  return (
    <div className="space-y-4">
      {meeting.status === 'processing' && <p role="status" className="text-sm text-neutral-400">Processing meeting…</p>}
      {canUpload && (
        <section className="rounded-xl border border-white/10 p-4">
          <h3 className="mb-3 font-medium">{meeting.status === 'failed' ? 'Retry upload' : 'Add transcript'}</h3>
          <TranscriptUploadModal allowAudio={meeting.ai_processing} onSubmit={async (input) => {
            const body = new FormData();
            if (input.audio || input.file) body.append('file', (input.audio || input.file)!);
            else body.append('text', input.text || '');
            await postApi(`/api/meetings/${meeting.id}/${input.audio ? 'audio' : 'transcript'}`, body);
            const startExtraction = !input.audio && meeting.ai_processing;
            if (startExtraction) await extract();
            else await onRefresh();
            if (input.audio) onTab('speakers');
          }} />
        </section>
      )}
      {canExtract && <Button onClick={extract} disabled={extracting}>
        {extracting ? 'Starting extraction…' : meeting.status === 'failed' ? 'Retry extraction' : 'Find action items'}
      </Button>}
      {actionError && <p role="alert" className="text-sm text-rose-300">{actionError}</p>}
      {excerpt && <section className="space-y-2 rounded-lg border border-white/10 bg-white/[0.03] p-4 text-sm text-neutral-300">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-medium text-neutral-400">{onBackToReview ? 'Suggestion source quote' : 'Task source quote'}</h3>
          {onBackToReview && <Button variant="ghost" size="sm" onClick={onBackToReview}>Back to review</Button>}
        </div>
        <blockquote className="whitespace-pre-wrap break-words">{excerpt}</blockquote>
      </section>}
      {loadError ? <p role="alert" className="text-sm text-rose-300">{loadError}</p>
        : transcriptId && !segments ? <p role="status" className="text-sm text-neutral-400">Loading transcript…</p>
        : segments?.length ? <div className="space-y-3">
          <Button variant="outline" size="sm" aria-pressed={showChapters} disabled={meeting.status === 'processing'} onClick={() => setShowChapters(!showChapters)}>
            {showChapters ? 'Hide chapters' : 'Show chapters alongside transcript'}
          </Button>
          {showChapters && !chapters?.length && (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-neutral-400" role={chapterResource.error ? 'alert' : 'status'}>
                {chapterResource.error ? 'Could not load chapters.' : chapters ? 'No chapters are available for this meeting.' : 'Loading chapters…'}
              </p>
              {chapterResource.error && <Button variant="outline" size="sm" onClick={chapterResource.retry}>Retry chapters</Button>}
            </div>
          )}
          {showChapters && chapters?.length ? (
            <MeetingChaptersTranscriptSplitView readOnly chapters={chapters} segments={segments} playbackSeconds={seek ?? -1}
              highlightedSegmentId={highlightedSegmentId} highlightedTimestamp={timestamp} onSeek={setSeek} />
          ) : (
            <div className="overflow-hidden rounded-xl border border-white/10">
              <MeetingTranscriptTab readOnly segments={segments} playbackSeconds={seek ?? -1}
                highlightedSegmentId={highlightedSegmentId} highlightedTimestamp={timestamp} onSeek={setSeek} />
            </div>
          )}
        </div> : !canUpload && meeting.status !== 'processing' && <p className="text-sm text-neutral-400">No transcript available.</p>}
    </div>
  );
}

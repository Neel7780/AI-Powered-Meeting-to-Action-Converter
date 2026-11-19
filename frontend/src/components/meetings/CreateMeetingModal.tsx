import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { MeetingCreationForm } from './MeetingCreationForm';
import type { CreatedMeeting } from './MeetingCreationForm';

interface CreateMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  onMeetingCreated: (meeting: CreatedMeeting) => void;
  initialDate?: string;
}

/** One creator shared by Meetings, Calendar, and the dashboard entry points. */
export function CreateMeetingModal({ isOpen, onClose, workspaceId, onMeetingCreated, initialDate }: CreateMeetingModalProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const savedMeeting = useRef<CreatedMeeting | null>(null);
  const finish = (meeting?: CreatedMeeting) => {
    const saved = meeting || savedMeeting.current;
    savedMeeting.current = null;
    onClose();
    if (saved) onMeetingCreated(saved);
  };

  useEffect(() => {
    if (!isOpen) return;
    savedMeeting.current = null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const element = dialog.current;
    element?.showModal();
    return () => { element?.close(); document.body.style.overflow = previousOverflow; };
  }, [isOpen]);

  if (!isOpen) return null;
  return (
    <dialog ref={dialog} aria-labelledby="create-meeting-heading"
      onCancel={(event) => { event.preventDefault(); if (!busy) finish(); }}
      className="m-auto max-h-[92dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-2xl border border-white/15 dashboard-surface bg-[#101013] p-0 text-white shadow-2xl backdrop:bg-black/75 backdrop:backdrop-blur-sm">
      <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/10 dashboard-surface bg-[#101013] px-5 py-5 sm:px-7">
        <div><h2 id="create-meeting-heading" className="text-xl font-semibold tracking-tight">Create meeting</h2></div>
        <button type="button" onClick={() => finish()} disabled={busy} aria-label="Close create meeting" className="rounded-lg p-2 text-neutral-400 hover:bg-white/10 hover:text-white disabled:opacity-40"><X className="size-5" /></button>
      </div>
      <MeetingCreationForm workspaceId={workspaceId} initialDate={initialDate} onBusyChange={setBusy} onSaved={(meeting) => { savedMeeting.current = meeting; }}
        onComplete={finish} />
    </dialog>
  );
}

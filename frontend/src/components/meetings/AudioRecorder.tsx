import { useEffect, useRef, useState } from 'react';
import { Circle, Mic, Square, Trash2, Upload } from 'lucide-react';
import { Button } from '../ui/button';

const AUDIO_EXTENSIONS = ['.webm', '.ogg', '.opus', '.mp3', '.m4a', '.mp4', '.wav'];
const MAX_BYTES = 50 * 1024 * 1024; // backend + Supabase free-tier per-file limit

function pickMimeType(): string {
  const options = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm', 'audio/mp4'];
  return options.find((t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) ?? '';
}

function extensionFor(mime: string): string {
  if (mime.includes('ogg')) return '.ogg';
  if (mime.includes('mp4')) return '.m4a';
  return '.webm';
}

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

interface AudioRecorderProps {
  /** Called with the finished recording (or an uploaded audio file); null when cleared. */
  onChange: (file: File | null) => void;
  onError: (message: string) => void;
}

/**
 * Records an offline (in-room) meeting in the browser with MediaRecorder.
 * Speech-friendly settings: mono, echo cancellation + noise suppression, ~32 kbps Opus
 * (about 15 MB per hour, well under the 50 MB limit).
 */
export function AudioRecorder({ onChange, onError }: AudioRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supported = typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices;

  useEffect(() => () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
  }, []);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  // Warn before closing the tab mid-recording: the audio only lives in memory until submitted.
  useEffect(() => {
    if (!recording) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [recording]);

  const setResult = (f: File | null) => {
    setFile(f);
    setPreviewUrl(f ? URL.createObjectURL(f) : null);
    onChange(f);
  };

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 32000 });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const type = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type });
        if (blob.size > MAX_BYTES) {
          onError('Recording is larger than 50 MB. Please record shorter sessions.');
          return;
        }
        const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
        setResult(new File([blob], `recording-${stamp}${extensionFor(type)}`, { type: type.split(';')[0] }));
      };
      // 10 s timeslices keep memory steady and avoid losing everything if the encoder hiccups
      recorder.start(10_000);
      recorderRef.current = recorder;
      setResult(null);
      setSeconds(0);
      setRecording(true);
      timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (err) {
      onError((err as Error).name === 'NotAllowedError'
        ? 'Microphone permission was denied. Allow it in the browser to record.'
        : `Could not start recording: ${(err as Error).message}`);
    }
  };

  const stop = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    setRecording(false);
  };

  const pickFile = (f: File | undefined) => {
    if (!f) return;
    const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase();
    if (!AUDIO_EXTENSIONS.includes(ext)) {
      onError(`Unsupported audio format. Use ${AUDIO_EXTENSIONS.join(', ')}`);
      return;
    }
    if (f.size > MAX_BYTES) {
      onError('Audio file is larger than 50 MB.');
      return;
    }
    setResult(f);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center justify-center rounded-md border border-white/10 p-8 text-center">
        <div className={`mb-4 flex size-14 items-center justify-center rounded-full border ${
          recording ? 'animate-pulse border-red-500/50 bg-red-500/15 text-red-400' : 'border-white/15 text-neutral-400'
        }`}>
          <Mic className="size-6" />
        </div>
        <p className="font-mono text-2xl tabular-nums text-white">{formatDuration(seconds)}</p>
        <p className="mt-1 text-xs text-neutral-500">
          {recording ? 'Recording… keep this tab open'
            : supported ? 'Place the device in the middle of the table for best results'
              : 'This browser cannot record audio. Upload a recording instead.'}
        </p>
        <div className="mt-5 flex gap-2">
          {recording ? (
            <Button type="button" variant="destructive" onClick={stop}><Square /> Stop</Button>
          ) : (
            <Button type="button" variant="outline" onClick={start} disabled={!supported}>
              <Circle className="fill-red-500 text-red-500" /> {file ? 'Record again' : 'Start recording'}
            </Button>
          )}
          {!recording && (
            <Button type="button" variant="ghost" onClick={() => fileInputRef.current?.click()}>
              <Upload /> Upload audio
            </Button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept={AUDIO_EXTENSIONS.join(',')}
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
        </div>
      </div>

      {file && previewUrl && !recording && (
        <div className="flex items-center gap-3 rounded-md border border-emerald-500/25 bg-emerald-500/5 p-3">
          <audio controls src={previewUrl} className="h-9 min-w-0 flex-1" />
          <span className="hidden font-mono text-[10px] text-neutral-400 sm:inline">
            {(file.size / 1024 / 1024).toFixed(1)} MB
          </span>
          <Button type="button" variant="ghost" size="icon" aria-label="Discard recording" onClick={() => setResult(null)}>
            <Trash2 />
          </Button>
        </div>
      )}
    </div>
  );
}

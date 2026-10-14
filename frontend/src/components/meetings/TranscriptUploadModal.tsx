import { useState, useRef } from 'react';
import { ArrowRight, FileText, LoaderCircle, Upload } from 'lucide-react';
import { Button } from '../ui/button';
import { Notice } from '../ui/notice';

interface TranscriptUploadModalProps {
  /** Sends the transcript to the backend; throw to show an error. */
  onSubmit: (input: { text?: string; file?: File }) => Promise<void>;
  progress?: string;
}

export function TranscriptUploadModal({ onSubmit, progress }: TranscriptUploadModalProps) {
  const [activeTab, setActiveTab] = useState<'paste' | 'upload'>('paste');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    // Basic sanitization
    const sanitized = e.target.value.replace(/<[^>]*>?/gm, '');
    setText(sanitized);
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    validateAndSetFile(droppedFile);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) validateAndSetFile(selectedFile);
  };

  const validateAndSetFile = (f: File) => {
    const allowedExtensions = ['.vtt', '.srt', '.txt', '.docx'];
    const extension = f.name.substring(f.name.lastIndexOf('.')).toLowerCase();

    if (!allowedExtensions.includes(extension)) {
      setStatus('error');
      setErrorMessage(`Unsupported file format. Please upload ${allowedExtensions.join(', ')}`);
      return;
    }
    setFile(f);
    setStatus('idle');
  };

  const handleSubmit = async () => {
    const input = activeTab === 'paste' ? { text: text.trim() } : { file: file ?? undefined };
    if (!input.text && !input.file) return;

    setIsUploading(true);
    setStatus('idle');
    setErrorMessage('');
    try {
      await onSubmit(input);
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setErrorMessage((err as Error).message || 'Failed to submit transcript');
    } finally {
      setIsUploading(false);
    }
  };

  const tabClass = (tab: 'paste' | 'upload') =>
    `flex flex-1 items-center justify-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
      activeTab === tab ? 'border-white text-white' : 'border-transparent text-neutral-500 hover:text-white'
    }`;

  return (
    <div className="overflow-hidden rounded-md border border-white/10 bg-black">
      <div role="tablist" className="flex border-b border-white/10">
        <button type="button" role="tab" aria-selected={activeTab === 'paste'} onClick={() => setActiveTab('paste')} className={tabClass('paste')}>
          <FileText className="size-4" />
          Paste text
        </button>
        <button type="button" role="tab" aria-selected={activeTab === 'upload'} onClick={() => setActiveTab('upload')} className={tabClass('upload')}>
          <Upload className="size-4" />
          Upload file
        </button>
      </div>

      <div className="p-5">
        {activeTab === 'paste' ? (
          <div>
            <textarea
              aria-label="Meeting transcript"
              className="field h-48 resize-y font-mono text-xs leading-6"
              placeholder="Paste your meeting transcript here..."
              value={text}
              onChange={handleTextChange}
            />
            <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-neutral-500">
              {text.length} characters
            </p>
          </div>
        ) : (
          <div
            className={`flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed p-10 text-center transition-colors ${
              file ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-white/15 hover:border-white/30 hover:bg-white/[0.02]'
            }`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".vtt,.srt,.txt,.docx"
              onChange={handleFileSelect}
            />
            <Upload className={`mb-4 size-8 ${file ? 'text-emerald-400' : 'text-neutral-500'}`} />
            <p className="text-sm font-medium text-white">
              {file ? file.name : 'Click or drag file to this area to upload'}
            </p>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-neutral-500">
              Supports .vtt, .srt, .txt, .docx
            </p>
          </div>
        )}

        <div className="mt-5 space-y-4">
          {status === 'success' && <Notice tone="success">Done! Opening review...</Notice>}
          {status === 'error' && <Notice tone="error">{errorMessage}</Notice>}

          <div className="flex justify-end">
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isUploading || (activeTab === 'paste' ? !text.trim() : !file)}
            >
              {isUploading ? (
                <>
                  <LoaderCircle className="animate-spin" />
                  {progress || 'Submitting...'}
                </>
              ) : (
                <>
                  Submit transcript <ArrowRight />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState, useRef } from 'react';
import { uploadTranscriptFile, uploadTranscriptText } from '../../services/storage';
import { Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';

interface TranscriptUploadModalProps {
  workspaceId: string;
  meetingId: string;
  onUploadSuccess: (path: string) => void;
}

export function TranscriptUploadModal({ workspaceId, meetingId, onUploadSuccess }: TranscriptUploadModalProps) {
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
    setIsUploading(true);
    setStatus('idle');
    setErrorMessage('');

    let result;
    if (activeTab === 'paste' && text.trim()) {
      result = await uploadTranscriptText(workspaceId, meetingId, text);
    } else if (activeTab === 'upload' && file) {
      result = await uploadTranscriptFile(workspaceId, meetingId, file);
    } else {
      setIsUploading(false);
      return;
    }

    if (result.error || !result.path) {
      setStatus('error');
      setErrorMessage(result.error?.message || 'Failed to upload transcript');
    } else {
      setStatus('success');
      onUploadSuccess(result.path);
    }
    
    setIsUploading(false);
  };

  return (
    <div className="w-full max-w-2xl bg-card border border-border rounded-lg shadow-sm overflow-hidden mt-6">
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab('paste')}
          className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${activeTab === 'paste' ? 'border-b-2 border-primary text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <div className="flex items-center justify-center gap-2">
            <FileText className="w-4 h-4" />
            Paste Text
          </div>
        </button>
        <button
          onClick={() => setActiveTab('upload')}
          className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${activeTab === 'upload' ? 'border-b-2 border-primary text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <div className="flex items-center justify-center gap-2">
            <Upload className="w-4 h-4" />
            Upload File
          </div>
        </button>
      </div>

      <div className="p-6">
        {activeTab === 'paste' ? (
          <div className="space-y-4">
            <textarea
              className="w-full h-48 rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Paste your meeting transcript here..."
              value={text}
              onChange={handleTextChange}
            />
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>{text.length} characters</span>
            </div>
          </div>
        ) : (
          <div
            className={`border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-colors
              ${file ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-primary/30'}
            `}
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
            <Upload className="w-10 h-10 text-muted-foreground mb-4" />
            <p className="text-sm font-medium text-foreground">
              {file ? file.name : 'Click or drag file to this area to upload'}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Supports .vtt, .srt, .txt, .docx
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="mt-4 p-3 bg-verified/20 border border-verified/30 rounded-md flex items-center gap-2 text-verified">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm">Upload successful!</span>
          </div>
        )}
        
        {status === 'error' && (
          <div className="mt-4 p-3 bg-destructive/20 border border-destructive/30 rounded-md flex items-center gap-2 text-destructive">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{errorMessage}</span>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={isUploading || (activeTab === 'paste' ? !text.trim() : !file)}
            className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isUploading ? (
              <>
                <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                Uploading...
              </>
            ) : (
              'Submit Transcript'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

import {
  useState,
  useRef,
  useEffect,
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent,
} from 'react';
import {
  Send,
  Paperclip,
  Smile,
  Sticker,
  X,
  FileIcon,
  Loader2,
  AlertCircle,
} from 'lucide-react';

import { useChat } from '../../context/ChatContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { uploadChatAttachment } from '../../services/chatService';
import EmojiPickerPopover from './EmojiPickerPopover';
import StickerPickerPopover from './StickerPickerPopover';

interface UploadingFile {
  file: File;
  previewUrl?: string;
  isImage: boolean;
  progress: number;
  uploadedData?: {
    fileName: string;
    fileUrl: string;
    fileType: string;
    fileSize: number;
    storagePath: string;
  };
  error?: string;
}

interface MessageComposerProps {
  replyingTo: {
    id: string;
    senderName: string;
    excerpt: string;
  } | null;
  onCancelReply: () => void;
}

export default function MessageComposer({
  replyingTo,
  onCancelReply,
}: MessageComposerProps) {
  const { currentWorkspace } = useWorkspace();
  const { activeConversation, sendMessage, sendTypingIndicator } = useChat();

  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<UploadingFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingThrottleRef = useRef<number>(0);
  const previewUrlsRef = useRef<Set<string>>(new Set());

  // Revoke any remaining object URLs on unmount to avoid memory leaks
  useEffect(() => {
    const urls = previewUrlsRef.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  // Auto resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [text]);

  const handleTextChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    setErrorMessage('');

    // Trigger typing indicator with 1.5s throttle
    const now = Date.now();
    if (now - typingThrottleRef.current > 1500) {
      sendTypingIndicator();
      typingThrottleRef.current = now;
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFiles = async (files: FileList | File[] | null) => {
    if (!files || files.length === 0 || !currentWorkspace || !activeConversation) return;

    const newUploads: UploadingFile[] = Array.from(files).map((f) => {
      const previewUrl = f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined;
      if (previewUrl) {
        previewUrlsRef.current.add(previewUrl);
      }
      return {
        file: f,
        isImage: f.type.startsWith('image/'),
        previewUrl,
        progress: 10,
      };
    });

    setAttachedFiles((prev) => [...prev, ...newUploads]);

    // Upload files sequentially or in parallel
    for (let i = 0; i < newUploads.length; i++) {
      const item = newUploads[i];
      try {
        const uploaded = await uploadChatAttachment(
          currentWorkspace.id,
          activeConversation.id,
          item.file
        );

        setAttachedFiles((prev) =>
          prev.map((f) =>
            f.file === item.file
              ? { ...f, progress: 100, uploadedData: uploaded }
              : f
          )
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Upload failed';
        setAttachedFiles((prev) =>
          prev.map((f) =>
            f.file === item.file
              ? { ...f, error: message }
              : f
          )
        );
      }
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items || items.length === 0) return;

    const pastedFiles: File[] = [];
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          pastedFiles.push(file);
        }
      }
    }

    if (pastedFiles.length > 0) {
      e.preventDefault();
      void handleFiles(pastedFiles);
    }
  };

  const removeAttachment = (fileToRemove: File) => {
    setAttachedFiles((prev) => {
      const target = prev.find((f) => f.file === fileToRemove);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
        previewUrlsRef.current.delete(target.previewUrl);
      }
      return prev.filter((f) => f.file !== fileToRemove);
    });
  };

  const handleSend = async () => {
    if (isSending) return;

    // Check if files are still uploading
    const stillUploading = attachedFiles.some((f) => !f.uploadedData && !f.error);
    if (stillUploading) {
      setErrorMessage('Please wait for files to finish uploading.');
      return;
    }

    const trimmed = text.trim();
    const readyAttachments = attachedFiles
      .filter((f) => f.uploadedData)
      .map((f) => f.uploadedData!);

    if (!trimmed && readyAttachments.length === 0) return;

    setIsSending(true);
    setErrorMessage('');

    try {
      await sendMessage(trimmed, {
        parentId: replyingTo?.id || null,
        attachments: readyAttachments,
      });

      attachedFiles.forEach((item) => {
        if (item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
          previewUrlsRef.current.delete(item.previewUrl);
        }
      });
      setText('');
      setAttachedFiles([]);
      onCancelReply();
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.focus();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send message';
      setErrorMessage(message);
    } finally {
      setIsSending(false);
    }
  };

  const handleSendSticker = async (stickerCode: string) => {
    if (!currentWorkspace || !activeConversation) return;
    setIsSending(true);
    try {
      await sendMessage(stickerCode, {
        isSticker: true,
        parentId: replyingTo?.id || null,
      });
      onCancelReply();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send sticker';
      setErrorMessage(message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div
      className={`relative border-t border-slate-200 bg-white p-3 transition sm:p-4 ${
        isDragging ? 'bg-indigo-50/50 ring-2 ring-indigo-500' : ''
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
    >
      {/* Replying Banner */}
      {replyingTo && (
        <div className="mb-2 flex items-center justify-between rounded-xl bg-indigo-50 px-3 py-1.5 text-xs text-indigo-700">
          <div className="flex items-center gap-2 truncate">
            <span className="font-semibold">Replying to {replyingTo.senderName}:</span>
            <span className="truncate text-slate-600">{replyingTo.excerpt}</span>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="rounded p-1 text-slate-400 hover:text-slate-700"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Attachment Previews */}
      {attachedFiles.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachedFiles.map((item, idx) => (
            <div
              key={idx}
              className={`relative flex items-center gap-2 rounded-xl border p-1.5 pr-3 text-xs shadow-sm ${
                item.error
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-slate-200 bg-slate-50 text-slate-700'
              }`}
            >
              {item.isImage && item.previewUrl ? (
                <img
                  src={item.previewUrl}
                  alt={item.file.name}
                  className="h-9 w-9 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                  <FileIcon className="h-4 w-4" />
                </div>
              )}

              <div className="max-w-[130px]">
                <p className="truncate font-medium">{item.file.name}</p>
                {item.error ? (
                  <p className="text-[10px] text-red-600">{item.error}</p>
                ) : !item.uploadedData ? (
                  <div className="flex items-center gap-1 text-[10px] text-slate-500">
                    <Loader2 className="h-2.5 w-2.5 animate-spin" /> Uploading...
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-400">
                    {(item.file.size / 1024).toFixed(0)} KB
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => removeAttachment(item.file)}
                className="ml-1 rounded-full p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Error Alert */}
      {errorMessage && (
        <div className="mb-2 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-600">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Composer Box */}
      <div className="rounded-2xl border border-slate-300 bg-white shadow-sm transition focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={`Message ${
            activeConversation?.type === 'channel'
              ? '#' + (activeConversation.name || 'channel')
              : activeConversation?.name || 'conversation'
          }...`}
          rows={1}
          className="max-h-44 w-full resize-none rounded-t-2xl border-none bg-transparent px-4 py-3 text-sm text-slate-800 placeholder-slate-400 outline-none"
        />

        {/* Toolbar & Action Buttons */}
        <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2">
          {/* Left Buttons: Attach, Emoji, Sticker */}
          <div className="flex items-center gap-1">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Attach File or Image (Max 10MB)"
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              <Paperclip className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                setShowEmojiPicker((v) => !v);
                setShowStickerPicker(false);
              }}
              title="Insert Emoji"
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              <Smile className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                setShowStickerPicker((v) => !v);
                setShowEmojiPicker(false);
              }}
              title="Send Team Sticker"
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              <Sticker className="h-4 w-4" />
            </button>
          </div>

          {/* Right Button: Send */}
          <div className="flex items-center gap-2">
            <span className="hidden text-[11px] text-slate-400 sm:inline">
              Enter to send, Shift+Enter for newline
            </span>

            <button
              type="button"
              disabled={isSending || (!text.trim() && attachedFiles.length === 0)}
              onClick={handleSend}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Popovers */}
      <EmojiPickerPopover
        isOpen={showEmojiPicker}
        onClose={() => setShowEmojiPicker(false)}
        onSelect={(emoji) => {
          setText((prev) => prev + emoji);
          if (textareaRef.current) textareaRef.current.focus();
        }}
      />

      <StickerPickerPopover
        isOpen={showStickerPicker}
        onClose={() => setShowStickerPicker(false)}
        onSelect={handleSendSticker}
      />
    </div>
  );
}

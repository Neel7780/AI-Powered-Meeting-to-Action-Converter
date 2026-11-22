import { useEffect, useRef, useState, type MouseEvent } from 'react';
import {
  Smile,
  Reply,
  Pencil,
  Trash2,
  Copy,
  Check,
  FileIcon,
  Download,
  ExternalLink,
  X,
  AlertCircle,
} from 'lucide-react';

import type { MessageAttachment, WorkspaceMessage } from '../../types/workspaceChat';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { getSignedAttachmentUrl, sanitizeAttachmentUrl } from '../../services/chatService';
import { extractFirstUrl } from '../../utils/chatHelpers';
import { STICKER_LIST } from './stickers';
import EmojiPickerPopover from './EmojiPickerPopover';
import LinkPreviewCard from './LinkPreviewCard';

interface MessageItemProps {
  message: WorkspaceMessage;
  isGrouped: boolean;
  onReply: (message: WorkspaceMessage) => void;
}

const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉', '🚀', '👀'];

export default function MessageItem({
  message,
  isGrouped,
  onReply,
}: MessageItemProps) {
  const { user } = useAuth();
  const { currentRole } = useWorkspace();
  const { editMessage, deleteMessage, toggleReaction } = useChat();

  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);
  const [isCopied, setIsCopied] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<MessageAttachment | null>(null);
  const [refreshedUrls, setRefreshedUrls] = useState<Record<string, string>>({});
  const refreshAttemptedRef = useRef<Set<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);

  const isOwn = user?.id === message.sender_id;
  const canDelete = isOwn || currentRole === 'admin' || currentRole === 'owner';
  const isDeleted = Boolean(message.deleted_at);

  useEffect(() => {
    if (!previewAttachment) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPreviewAttachment(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewAttachment]);

  const getEffectiveAttachmentUrl = (att: MessageAttachment): string =>
    sanitizeAttachmentUrl(refreshedUrls[att.id] || att.file_url);

  const refreshAttachmentUrl = async (att: MessageAttachment): Promise<string | null> => {
    if (!att.storage_path) return null;
    try {
      const freshUrl = sanitizeAttachmentUrl(await getSignedAttachmentUrl(att.storage_path));
      if (freshUrl) {
        setRefreshedUrls((prev) => ({ ...prev, [att.id]: freshUrl }));
        return freshUrl;
      }
      return null;
    } catch {
      return null;
    }
  };

  const handleImageError = async (att: MessageAttachment) => {
    if (!att.storage_path || refreshAttemptedRef.current.has(att.id)) return;
    refreshAttemptedRef.current.add(att.id);
    await refreshAttachmentUrl(att);
  };

  const handleOpenAttachment = async (
    e: MouseEvent<HTMLAnchorElement>,
    att: MessageAttachment
  ) => {
    if (!att.storage_path) return;
    e.preventDefault();
    setActionError(null);
    const freshUrl = await refreshAttachmentUrl(att);
    if (freshUrl) {
      window.open(freshUrl, '_blank', 'noopener,noreferrer');
    } else {
      setActionError('Unable to access this attachment. It may have been deleted.');
    }
  };

  const stickerInfo = message.is_sticker
    ? STICKER_LIST.find((s) => s.id === message.content)
    : null;
  const firstLinkUrl =
    !isDeleted && !message.is_sticker ? extractFirstUrl(message.content) : null;

  // Group reactions by emoji
  const reactionCounts: Record<string, { count: number; userReacted: boolean }> = {};
  (message.reactions || []).forEach((r) => {
    if (!reactionCounts[r.emoji]) {
      reactionCounts[r.emoji] = { count: 0, userReacted: false };
    }
    reactionCounts[r.emoji].count += 1;
    if (r.user_id === user?.id) {
      reactionCounts[r.emoji].userReacted = true;
    }
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleSaveEdit = async () => {
    if (!editText.trim()) return;
    setActionError(null);
    try {
      await editMessage(message.id, editText.trim());
      setIsEditing(false);
    } catch (err: unknown) {
      console.error('Failed to edit message:', err);
      setActionError(err instanceof Error ? err.message : 'Failed to save edit.');
    }
  };

  const handleDelete = async () => {
    setActionError(null);
    try {
      await deleteMessage(message.id);
      setShowConfirmDelete(false);
    } catch (err: unknown) {
      console.error('Failed to delete message:', err);
      setShowConfirmDelete(false);
      setActionError(err instanceof Error ? err.message : 'Failed to delete message.');
    }
  };

  const handleToggleReaction = async (emoji: string) => {
    setActionError(null);
    try {
      await toggleReaction(message.id, emoji);
    } catch (err: unknown) {
      console.error('Failed to toggle reaction:', err);
      setActionError(err instanceof Error ? err.message : 'Failed to update reaction.');
    }
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Helper to render URL links in text
  const renderContent = (content: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = content.split(urlRegex);

    return parts.map((part, i) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-indigo-600 underline hover:text-indigo-800"
          >
            {part}
            <ExternalLink className="h-3 w-3 inline" />
          </a>
        );
      }
      return part;
    });
  };

  return (
    <div
      className={`group relative flex gap-3 px-4 py-1.5 transition hover:bg-slate-50/80 ${
        isGrouped ? 'pt-0.5' : 'mt-2 pt-1'
      }`}
    >
      {/* Sender Avatar */}
      {!isGrouped ? (
        <div className="flex h-10 w-10 shrink-0 select-none items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-sm font-bold text-white shadow-sm">
          {message.sender?.display_name?.charAt(0).toUpperCase() || 'U'}
        </div>
      ) : (
        <div className="w-10 shrink-0 text-right">
          <span className="hidden text-[10px] text-slate-400 group-hover:inline">
            {formatTime(message.created_at)}
          </span>
        </div>
      )}

      {/* Message Body */}
      <div className="min-w-0 flex-1">
        {/* Header (Sender & Timestamp) */}
        {!isGrouped && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">
              {message.sender?.display_name || 'Member'}
            </span>
            <span className="text-[11px] text-slate-400">
              {formatTime(message.created_at)}
            </span>
            {message.edited_at && !isDeleted && (
              <span className="text-[10px] text-slate-400">(edited)</span>
            )}
          </div>
        )}

        {/* Thread Parent Preview */}
        {message.parent && (
          <div className="my-1 flex items-center gap-2 border-l-2 border-indigo-300 bg-indigo-50/60 px-2 py-0.5 text-xs text-indigo-800 rounded-r">
            <span className="font-semibold">{message.parent.sender_name}:</span>
            <span className="truncate text-slate-600">{message.parent.content}</span>
          </div>
        )}

        {/* Inline Editing */}
        {isEditing ? (
          <div className="mt-2 space-y-2">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full rounded-xl border border-indigo-400 p-2 text-sm text-slate-900 outline-none ring-2 ring-indigo-100"
              rows={2}
            />
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={handleSaveEdit}
                className="rounded-lg bg-indigo-600 px-3 py-1 font-semibold text-white hover:bg-indigo-700"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setEditText(message.content);
                }}
                className="rounded-lg border border-slate-300 px-3 py-1 font-medium text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : isDeleted ? (
          <p className="text-sm italic text-slate-400">This message was deleted.</p>
        ) : stickerInfo ? (
          /* Sticker Display */
          <div className="my-1 inline-block">
            <div
              className={`rounded-2xl bg-gradient-to-br ${stickerInfo.color} px-4 py-2 text-sm font-bold ${stickerInfo.textClass} shadow-md`}
            >
              {stickerInfo.label}
              <p className={`text-[10px] ${stickerInfo.descClass} font-normal`}>{stickerInfo.desc}</p>
            </div>
          </div>
        ) : (
          /* Normal Message Text */
          <div className="text-sm leading-relaxed text-slate-800 whitespace-pre-wrap break-words">
            {renderContent(message.content)}
            {isGrouped && message.edited_at && !isDeleted && (
              <span className="ml-1.5 text-[10px] text-slate-400">(edited)</span>
            )}
          </div>
        )}

        {/* Link Preview Card */}
        {firstLinkUrl && !isEditing && <LinkPreviewCard url={firstLinkUrl} />}

        {/* Inline Action Error */}
        {actionError && (
          <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-2.5 py-1 text-[11px] text-red-600">
            <AlertCircle className="h-3 w-3 shrink-0" />
            <span>{actionError}</span>
            <button
              type="button"
              onClick={() => setActionError(null)}
              className="ml-1 text-red-400 hover:text-red-700"
              aria-label="Dismiss error"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Message Attachments */}
        {message.attachments && message.attachments.length > 0 && !isDeleted && (
          <div className="mt-2 flex flex-wrap gap-3">
            {message.attachments.map((att) => {
              const safeUrl = getEffectiveAttachmentUrl(att);
              if (!safeUrl && !att.storage_path) return null;
              const isImg = att.file_type.startsWith('image/');
              return isImg ? (
                <div key={att.id} className="relative group/att">
                  <img
                    src={safeUrl}
                    alt={att.file_name}
                    onClick={() => setPreviewAttachment(att)}
                    onError={() => void handleImageError(att)}
                    className="max-h-60 max-w-sm rounded-xl border border-slate-200 object-cover shadow-sm transition hover:opacity-95 cursor-pointer"
                  />
                  <a
                    href={safeUrl}
                    download={att.file_name}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => void handleOpenAttachment(e, att)}
                    className="absolute top-2 right-2 rounded-lg bg-black/60 p-1.5 text-white opacity-0 transition group-hover/att:opacity-100 hover:bg-black/80"
                    title="Download"
                  >
                    <Download className="h-4 w-4" />
                  </a>
                </div>
              ) : (
                <a
                  key={att.id}
                  href={safeUrl}
                  download={att.file_name}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => void handleOpenAttachment(e, att)}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/50"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                    <FileIcon className="h-5 w-5" />
                  </div>
                  <div className="max-w-[200px]">
                    <p className="truncate font-semibold text-slate-800">{att.file_name}</p>
                    <p className="text-xs text-slate-400">
                      {(att.file_size / 1024).toFixed(0)} KB • Click to download
                    </p>
                  </div>
                  <Download className="h-4 w-4 text-slate-400" />
                </a>
              );
            })}
          </div>
        )}

        {/* Reactions List */}
        {Object.keys(reactionCounts).length > 0 && !isDeleted && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {Object.entries(reactionCounts).map(([emoji, { count, userReacted }]) => (
              <button
                key={emoji}
                type="button"
                onClick={() => void handleToggleReaction(emoji)}
                className={`flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition ${
                  userReacted
                    ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span>{emoji}</span>
                <span>{count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Hover Action Bar */}
      {!isDeleted && (
        <div className="absolute right-4 -top-3 hidden items-center gap-0.5 rounded-xl border border-slate-200 bg-white p-1 shadow-md group-hover:flex">
          {/* Quick Reaction Buttons */}
          {QUICK_REACTIONS.slice(0, 3).map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => void handleToggleReaction(emoji)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-sm hover:bg-slate-100"
              title={`React with ${emoji}`}
            >
              {emoji}
            </button>
          ))}

          <button
            type="button"
            onClick={() => setShowEmojiPicker(true)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
            title="Add Reaction"
          >
            <Smile className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => onReply(message)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
            title="Reply"
          >
            <Reply className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
            title="Copy Text"
          >
            {isCopied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
          </button>

          {isOwn && !message.is_sticker && (
            <button
              type="button"
              onClick={() => {
                setEditText(message.content);
                setIsEditing(true);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              title="Edit Message"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}

          {canDelete && (
            <button
              type="button"
              onClick={() => setShowConfirmDelete(true)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600"
              title="Delete Message"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Popover for extra emojis */}
      <EmojiPickerPopover
        isOpen={showEmojiPicker}
        onClose={() => setShowEmojiPicker(false)}
        onSelect={(emoji) => void handleToggleReaction(emoji)}
      />

      {/* Confirmation Modal for Delete */}
      {showConfirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900">Delete message</h3>
            <p className="mt-2 text-sm text-slate-600">
              Are you sure you want to delete this message? This action cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowConfirmDelete(false)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Image Preview */}
      {previewAttachment && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreviewAttachment(null)}
        >
          <button
            type="button"
            onClick={() => setPreviewAttachment(null)}
            aria-label="Close image preview"
            className="absolute right-4 top-4 rounded-full bg-white/15 p-2 text-white transition hover:bg-white/25"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={getEffectiveAttachmentUrl(previewAttachment)}
            alt={previewAttachment.file_name || 'Expanded attachment'}
            onClick={(e) => e.stopPropagation()}
            onError={() => void handleImageError(previewAttachment)}
            className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain shadow-2xl"
          />
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Hash, Lock, X, Loader2, AlertCircle } from 'lucide-react';

import { useChat } from '../../context/ChatContext';
import type { Conversation } from '../../types/chat';

interface EditChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  channel: Conversation;
}

export default function EditChannelModal({
  isOpen,
  onClose,
  channel,
}: EditChannelModalProps) {
  const { updateChannelDetails } = useChat();

  const isGeneral = channel.name === 'general';

  const [name, setName] = useState(channel.name || '');
  const [topic, setTopic] = useState(channel.topic || '');
  const [description, setDescription] = useState(channel.description || '');
  const [isPrivate, setIsPrivate] = useState(Boolean(channel.is_private));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName(channel.name || '');
      setTopic(channel.topic || '');
      setDescription(channel.description || '');
      setIsPrivate(Boolean(channel.is_private));
      setError(null);
    }
  }, [isOpen, channel]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanName = isGeneral
      ? 'general'
      : name
          .trim()
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9_-]/g, '');

    if (!cleanName || cleanName.length < 2) {
      setError('Channel name must be at least 2 characters long.');
      return;
    }

    if (cleanName.length > 80) {
      setError('Channel name cannot exceed 80 characters.');
      return;
    }

    setLoading(true);

    try {
      await updateChannelDetails(channel.id, {
        name: cleanName,
        topic: topic.trim() || undefined,
        description: description.trim() || undefined,
        isPrivate: isGeneral ? false : isPrivate,
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update channel details.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              {isPrivate ? <Lock className="h-5 w-5" /> : <Hash className="h-5 w-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Channel Settings</h2>
              <p className="text-xs text-slate-500">Edit details for #{channel.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Name Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Channel Name
            </label>
            <div
              className={`mt-1 flex items-center rounded-xl border px-3 py-2 ${
                isGeneral
                  ? 'border-slate-200 bg-slate-100/70 text-slate-400 cursor-not-allowed'
                  : 'border-slate-300 bg-white focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100'
              }`}
            >
              <span className="text-sm font-semibold text-slate-400">#</span>
              <input
                type="text"
                required
                disabled={isGeneral}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="channel-name"
                className="ml-2 w-full text-sm text-slate-900 outline-none disabled:bg-transparent disabled:text-slate-400"
              />
            </div>
            {isGeneral ? (
              <p className="mt-1 text-[11px] text-amber-600 font-medium">
                The #general channel cannot be renamed.
              </p>
            ) : (
              <p className="mt-1 text-[11px] text-slate-400">
                Names must be lowercase, without spaces or periods (e.g. project-updates).
              </p>
            )}
          </div>

          {/* Topic Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Topic <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input
              type="text"
              maxLength={250}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="What is this channel about?"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {/* Description Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Description <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              rows={3}
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Give members more context on how to use this channel."
              className="mt-1 w-full resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {/* Privacy Toggle */}
          <div
            className={`rounded-xl border p-3 ${
              isGeneral ? 'border-slate-200 bg-slate-50' : 'border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800">
                  {isPrivate ? 'Private Channel' : 'Public Channel'}
                </span>
                <p className="text-[11px] text-slate-500">
                  {isGeneral
                    ? 'The #general channel must remain public for all workspace members.'
                    : isPrivate
                    ? 'Only invited members can view and send messages.'
                    : 'Anyone in this workspace can find and join this channel.'}
                </p>
              </div>

              <label
                className={`relative inline-flex items-center ${
                  isGeneral ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                }`}
              >
                <input
                  type="checkbox"
                  disabled={isGeneral}
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  className="peer sr-only"
                />
                <div className="peer h-5 w-9 rounded-full bg-slate-200 after:absolute after:top-[2px] after:left-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-indigo-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-hidden" />
              </label>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


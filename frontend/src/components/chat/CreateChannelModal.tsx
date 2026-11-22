import { useState } from 'react';
import { Hash, Lock, X, Loader2 } from 'lucide-react';

import { useChat } from '../../context/ChatContext';

interface CreateChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateChannelModal({
  isOpen,
  onClose,
}: CreateChannelModalProps) {
  const { createChannel } = useChat();

  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '');

    if (!cleanName) {
      setError('Please provide a valid channel name.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await createChannel({
        name: cleanName,
        topic: topic.trim() || undefined,
        description: description.trim() || undefined,
        isPrivate,
      });

      onClose();
      setName('');
      setTopic('');
      setDescription('');
      setIsPrivate(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create channel.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              {isPrivate ? <Lock className="h-5 w-5" /> : <Hash className="h-5 w-5" />}
            </div>
            <h2 className="text-lg font-bold text-slate-900">Create a channel</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && (
            <div className="rounded-xl bg-red-50 p-3 text-xs text-red-600">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Channel Name
            </label>
            <div className="mt-1 flex items-center rounded-xl border border-slate-300 px-3 py-2 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100">
              <span className="text-sm font-semibold text-slate-400">#</span>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. sprint-retrospective"
                className="ml-2 w-full text-sm text-slate-900 outline-none"
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Names must be lowercase, without spaces or special characters.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Topic (Optional)
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="What is this channel about?"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide context or purpose for members"
              className="mt-1 w-full resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {/* Visibility toggle */}
          <div className="flex items-start justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-3">
            <div>
              <p className="text-xs font-bold text-slate-800">
                {isPrivate ? 'Make Private' : 'Make Public'}
              </p>
              <p className="text-[11px] text-slate-500">
                {isPrivate
                  ? 'Only invited members can view this channel and its messages.'
                  : 'Anyone in the workspace can view and join this channel.'}
              </p>
            </div>
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Channel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


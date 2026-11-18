import { useEffect, useRef, useState, type MouseEvent } from 'react';
import {
  X,
  Hash,
  Lock,
  FileIcon,
  LogOut,
  Download,
  Loader2,
} from 'lucide-react';

import type { ConversationMember, MessageAttachment } from '../../types/chat';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import {
  fetchConversationMembers,
  getSignedAttachmentUrl,
  sanitizeAttachmentUrl,
} from '../../services/chatService';

interface ConversationDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ConversationDetailsDrawer({
  isOpen,
  onClose,
}: ConversationDetailsDrawerProps) {
  const { user } = useAuth();
  const { activeConversation, onlineUsers, messages, leaveChannel } = useChat();

  const [members, setMembers] = useState<ConversationMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [refreshedUrls, setRefreshedUrls] = useState<Record<string, string>>({});
  const refreshAttemptedRef = useRef<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'about' | 'members' | 'files'>('about');

  const getEffectiveUrl = (att: MessageAttachment): string =>
    sanitizeAttachmentUrl(refreshedUrls[att.id] || att.file_url);

  const refreshFileUrl = async (att: MessageAttachment): Promise<string | null> => {
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

  const handleThumbError = async (att: MessageAttachment) => {
    if (!att.storage_path || refreshAttemptedRef.current.has(att.id)) return;
    refreshAttemptedRef.current.add(att.id);
    await refreshFileUrl(att);
  };

  const handleOpenFile = async (e: MouseEvent<HTMLAnchorElement>, att: MessageAttachment) => {
    if (!att.storage_path) return;
    e.preventDefault();
    setFileError(null);
    const freshUrl = await refreshFileUrl(att);
    if (freshUrl) {
      window.open(freshUrl, '_blank', 'noopener,noreferrer');
    } else {
      setFileError('Unable to open this file. It may have been deleted.');
    }
  };

  useEffect(() => {
    let isMounted = true;
    if (!isOpen || !activeConversation || activeConversation.type !== 'channel') {
      return;
    }

    const loadMembers = async () => {
      setLoadingMembers(true);
      setMembersError(null);
      try {
        const data = await fetchConversationMembers(activeConversation.id);
        if (isMounted) {
          setMembers(data);
        }
      } catch (err: unknown) {
        if (isMounted) {
          console.error('Failed to load conversation members:', err);
          setMembersError(err instanceof Error ? err.message : 'Failed to load members.');
        }
      } finally {
        if (isMounted) {
          setLoadingMembers(false);
        }
      }
    };

    void loadMembers();

    return () => {
      isMounted = false;
    };
  }, [isOpen, activeConversation]);

  if (!isOpen || !activeConversation) return null;

  // Extract shared files from messages
  const allAttachments: MessageAttachment[] = messages.flatMap(
    (m) => m.attachments || []
  );

  const isChannel = activeConversation.type === 'channel';

  return (
    <div className="flex h-full w-72 flex-col border-l border-slate-200 bg-white shadow-sm lg:w-80">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4">
        <h3 className="text-sm font-bold text-slate-900">Details</h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-slate-50/50 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab('about')}
          className={`flex-1 py-2.5 text-center transition ${
            activeTab === 'about'
              ? 'border-b-2 border-indigo-600 bg-white text-indigo-600 font-bold'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          About
        </button>
        {isChannel && (
          <button
            type="button"
            onClick={() => setActiveTab('members')}
            className={`flex-1 py-2.5 text-center transition ${
              activeTab === 'members'
                ? 'border-b-2 border-indigo-600 bg-white text-indigo-600 font-bold'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Members ({members.length})
          </button>
        )}
        <button
          type="button"
          onClick={() => setActiveTab('files')}
          className={`flex-1 py-2.5 text-center transition ${
            activeTab === 'files'
              ? 'border-b-2 border-indigo-600 bg-white text-indigo-600 font-bold'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          Files ({allAttachments.length})
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'about' && (
          <div className="space-y-4 text-xs">
            <div>
              <p className="font-semibold uppercase tracking-wider text-slate-400">
                {isChannel ? 'Channel Name' : 'Direct Message'}
              </p>
              <div className="mt-1 flex items-center gap-1.5 font-bold text-sm text-slate-900">
                {isChannel ? (
                  activeConversation.is_private ? (
                    <Lock className="h-4 w-4 text-slate-500" />
                  ) : (
                    <Hash className="h-4 w-4 text-slate-500" />
                  )
                ) : null}
                <span>{activeConversation.name}</span>
              </div>
            </div>

            {isChannel && (
              <>
                <div>
                  <p className="font-semibold uppercase tracking-wider text-slate-400">
                    Topic
                  </p>
                  <p className="mt-1 text-slate-700">
                    {activeConversation.topic || 'No topic configured'}
                  </p>
                </div>

                <div>
                  <p className="font-semibold uppercase tracking-wider text-slate-400">
                    Description
                  </p>
                  <p className="mt-1 text-slate-700">
                    {activeConversation.description || 'No description provided'}
                  </p>
                </div>
              </>
            )}

            <div>
              <p className="font-semibold uppercase tracking-wider text-slate-400">
                Created
              </p>
              <p className="mt-1 text-slate-700">
                {new Date(activeConversation.created_at).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            </div>

            {isChannel && (
              <div className="pt-4 border-t border-slate-100 space-y-2">
                {leaveError && (
                  <p className="rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] text-red-600">
                    {leaveError}
                  </p>
                )}
                <button
                  type="button"
                  onClick={async () => {
                    setLeaveError(null);
                    try {
                      await leaveChannel(activeConversation.id);
                      onClose();
                    } catch (err: unknown) {
                      setLeaveError(
                        err instanceof Error ? err.message : 'Failed to leave channel.'
                      );
                    }
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-2 font-semibold text-red-600 hover:bg-red-100"
                >
                  <LogOut className="h-4 w-4" />
                  Leave Channel
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'members' && isChannel && (
          <div>
            {loadingMembers ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
              </div>
            ) : membersError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-center text-xs text-red-600">
                {membersError}
              </div>
            ) : members.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-6">
                No members found
              </p>
            ) : (
              <div className="space-y-2">
                {members.map((m) => {
                  const isOnline = onlineUsers.has(m.user_id);
                  return (
                    <div
                      key={m.user_id}
                      className="flex items-center gap-3 rounded-xl p-2 hover:bg-slate-50"
                    >
                      <div className="relative shrink-0">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-xs font-bold text-white">
                          {m.profile?.display_name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        {isOnline && (
                          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-white bg-emerald-500" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-slate-900">
                          {m.profile?.display_name || 'Member'}
                          {m.user_id === user?.id && ' (You)'}
                        </p>
                        <p className="truncate text-[10px] text-slate-400">
                          {m.profile?.email}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'files' && (
          <div>
            {fileError && (
              <p className="mb-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] text-red-600">
                {fileError}
              </p>
            )}
            {allAttachments.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-8">
                No files or images shared yet
              </p>
            ) : (
              <div className="space-y-2">
                {allAttachments.map((att) => {
                  const safeUrl = getEffectiveUrl(att);
                  if (!safeUrl && !att.storage_path) return null;
                  const isImg = att.file_type.startsWith('image/');
                  return (
                    <a
                      key={att.id}
                      href={safeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => void handleOpenFile(e, att)}
                      className="flex items-center gap-2.5 rounded-xl border border-slate-200 p-2 text-xs shadow-xs transition hover:border-indigo-200 hover:bg-indigo-50/50"
                    >
                      {isImg ? (
                        <img
                          src={safeUrl}
                          alt={att.file_name}
                          onError={() => void handleThumbError(att)}
                          className="h-9 w-9 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 shrink-0">
                          <FileIcon className="h-4 w-4" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-slate-800">
                          {att.file_name}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {(att.file_size / 1024).toFixed(0)} KB
                        </p>
                      </div>
                      <Download className="h-4 w-4 text-slate-400 shrink-0" />
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

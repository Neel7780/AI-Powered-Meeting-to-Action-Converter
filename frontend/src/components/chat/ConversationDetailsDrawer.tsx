import { useEffect, useRef, useState, useCallback, type MouseEvent } from 'react';
import {
  X,
  Hash,
  Lock,
  FileIcon,
  LogOut,
  Download,
  Loader2,
  Settings,
  UserPlus,
  UserMinus,
  Crown,
  Pin,
} from 'lucide-react';

import type { ConversationMember, MessageAttachment } from '../../types/chat';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import {
  fetchConversationMembers,
  getSignedAttachmentUrl,
  sanitizeAttachmentUrl,
} from '../../services/chatService';
import EditChannelModal from './EditChannelModal';
import InviteMemberModal from './InviteMemberModal';

interface ConversationDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ConversationDetailsDrawer({
  isOpen,
  onClose,
}: ConversationDetailsDrawerProps) {
  const { user } = useAuth();
  const { currentRole } = useWorkspace();
  const {
    activeConversation,
    onlineUsers,
    messages,
    leaveChannel,
    removeChannelMember,
    pinnedMessages,
    unpinMessage,
    isConversationMuted,
    toggleMuteConversation,
  } = useChat();

  const [members, setMembers] = useState<ConversationMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [refreshedUrls, setRefreshedUrls] = useState<Record<string, string>>({});
  const refreshAttemptedRef = useRef<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'about' | 'members' | 'files' | 'pinned'>('about');

  // Channel management modals & actions
  const [showEditModal, setShowEditModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<ConversationMember | null>(null);
  const [isRemovingMember, setIsRemovingMember] = useState(false);
  const [showConfirmLeave, setShowConfirmLeave] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const isChannel = activeConversation?.type === 'channel';
  const isGeneral = activeConversation?.name === 'general';
  const isWorkspaceAdmin = currentRole === 'admin' || currentRole === 'owner';
  const isChannelCreator = activeConversation?.created_by === user?.id;
  const canManageChannel = Boolean(isChannel && (isWorkspaceAdmin || isChannelCreator));

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

  const loadMembers = useCallback(async () => {
    if (!activeConversation || activeConversation.type !== 'channel') {
      return;
    }
    setLoadingMembers(true);
    setMembersError(null);
    try {
      const data = await fetchConversationMembers(activeConversation.id);
      setMembers(data);
    } catch (err: unknown) {
      console.error('Failed to load conversation members:', err);
      setMembersError(err instanceof Error ? err.message : 'Failed to load members.');
    } finally {
      setLoadingMembers(false);
    }
  }, [activeConversation]);

  useEffect(() => {
    if (!isOpen || !activeConversation || activeConversation.type !== 'channel') {
      return;
    }
    void loadMembers();
  }, [isOpen, activeConversation, loadMembers]);

  const handleConfirmRemoveMember = async () => {
    if (!memberToRemove || !activeConversation) return;
    setIsRemovingMember(true);
    setMembersError(null);
    try {
      await removeChannelMember(activeConversation.id, memberToRemove.user_id);
      setMemberToRemove(null);
      await loadMembers();
    } catch (err: unknown) {
      setMembersError(
        err instanceof Error ? err.message : 'Failed to remove member from channel'
      );
    } finally {
      setIsRemovingMember(false);
    }
  };

  const handleConfirmLeave = async () => {
    if (!activeConversation) return;
    setIsLeaving(true);
    setLeaveError(null);
    try {
      await leaveChannel(activeConversation.id);
      setShowConfirmLeave(false);
      onClose();
    } catch (err: unknown) {
      setLeaveError(
        err instanceof Error ? err.message : 'Failed to leave channel.'
      );
    } finally {
      setIsLeaving(false);
    }
  };

  if (!isOpen || !activeConversation) return null;

  // Extract shared files from messages
  const allAttachments: MessageAttachment[] = messages.flatMap(
    (m) => m.attachments || []
  );

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
          onClick={() => setActiveTab('pinned')}
          className={`flex-1 py-2.5 text-center transition ${
            activeTab === 'pinned'
              ? 'border-b-2 border-indigo-600 bg-white text-indigo-600 font-bold'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          Pinned ({pinnedMessages.length})
        </button>
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
                {isChannel && (
                  <span className="ml-1 inline-block rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                    {activeConversation.is_private ? 'Private' : 'Public'}
                  </span>
                )}
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

            {/* Notifications & Muting Toggle */}
            <div className="pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-800 text-xs">Mute Notifications</p>
                  <p className="text-[10px] text-slate-400">
                    Mute sound and banner alerts for this conversation
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleMuteConversation(activeConversation.id)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                    isConversationMuted(activeConversation.id) ? 'bg-indigo-600' : 'bg-slate-200'
                  }`}
                  role="switch"
                  aria-checked={isConversationMuted(activeConversation.id)}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      isConversationMuted(activeConversation.id) ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {isChannel && (
              <div className="pt-4 border-t border-slate-100 space-y-3">
                {/* Channel settings button for creator or admins */}
                {canManageChannel && (
                  <button
                    type="button"
                    onClick={() => setShowEditModal(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2 text-xs font-semibold text-slate-700 shadow-xs hover:border-indigo-200 hover:bg-indigo-50/50 transition"
                  >
                    <Settings className="h-3.5 w-3.5 text-slate-500" />
                    <span>Edit Channel Details</span>
                  </button>
                )}

                {/* Leave channel section */}
                {leaveError && (
                  <p className="rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] text-red-600">
                    {leaveError}
                  </p>
                )}

                {isGeneral ? (
                  <div className="rounded-xl bg-slate-50 p-2.5 text-center text-[11px] text-slate-500">
                    The #general channel cannot be left.
                  </div>
                ) : showConfirmLeave ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 space-y-2">
                    <p className="text-xs font-semibold text-red-800">
                      Leave #{activeConversation.name}?
                    </p>
                    <p className="text-[11px] text-red-600">
                      {activeConversation.is_private
                        ? 'This is a private channel. You will need an invite to rejoin.'
                        : 'You can rejoin anytime from the channel browser.'}
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        disabled={isLeaving}
                        onClick={handleConfirmLeave}
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        {isLeaving ? 'Leaving...' : 'Confirm Leave'}
                      </button>
                      <button
                        type="button"
                        disabled={isLeaving}
                        onClick={() => setShowConfirmLeave(false)}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowConfirmLeave(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-2 font-semibold text-red-600 hover:bg-red-100 transition"
                  >
                    <LogOut className="h-4 w-4" />
                    Leave Channel
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'members' && isChannel && (
          <div className="space-y-3">
            {/* Members header with Add Member button */}
            <div className="flex items-center justify-between pb-1 border-b border-slate-100">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Members ({members.length})
              </span>
              <button
                type="button"
                onClick={() => setShowInviteModal(true)}
                className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-100 transition"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>Add Member</span>
              </button>
            </div>

            {/* Member removal confirmation prompt */}
            {memberToRemove && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 space-y-2">
                <p className="text-xs font-semibold text-red-800">
                  Remove {memberToRemove.profile?.display_name || 'member'} from #{activeConversation.name}?
                </p>
                <p className="text-[11px] text-red-600">
                  They will no longer have access to this channel and its history.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isRemovingMember}
                    onClick={handleConfirmRemoveMember}
                    className="rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {isRemovingMember ? 'Removing...' : 'Confirm Remove'}
                  </button>
                  <button
                    type="button"
                    disabled={isRemovingMember}
                    onClick={() => setMemberToRemove(null)}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

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
              <div className="space-y-1">
                {members.map((m) => {
                  const isOnline = onlineUsers.has(m.user_id);
                  const isCreator = m.user_id === activeConversation.created_by;
                  const isSelf = m.user_id === user?.id;

                  return (
                    <div
                      key={m.user_id}
                      className="group flex items-center justify-between gap-2 rounded-xl p-2 hover:bg-slate-50 transition"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="relative shrink-0">
                          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-xs font-bold text-white">
                            {m.profile?.display_name?.charAt(0).toUpperCase() || 'U'}
                          </div>
                          {isOnline && (
                            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-white bg-emerald-500" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="truncate text-xs font-semibold text-slate-900">
                              {m.profile?.display_name || 'Member'}
                              {isSelf && ' (You)'}
                            </p>
                            {isCreator && (
                              <span
                                className="inline-flex items-center gap-0.5 rounded-md bg-amber-50 px-1 py-0.5 text-[9px] font-semibold text-amber-700"
                                title="Channel Creator"
                              >
                                <Crown className="h-2.5 w-2.5 text-amber-600" />
                                Creator
                              </span>
                            )}
                          </div>
                          <p className="truncate text-[10px] text-slate-400">
                            {m.profile?.email}
                          </p>
                        </div>
                      </div>

                      {/* Remove button for admins / creator */}
                      {canManageChannel && !isCreator && !isSelf && (
                        <button
                          type="button"
                          onClick={() => setMemberToRemove(m)}
                          className="opacity-0 group-hover:opacity-100 rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                          title={`Remove ${m.profile?.display_name || 'member'}`}
                        >
                          <UserMinus className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'pinned' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-slate-100">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Pinned Messages ({pinnedMessages.length})
              </span>
            </div>

            {pinnedMessages.length === 0 ? (
              <div className="text-center py-8">
                <Pin className="mx-auto h-8 w-8 text-slate-300 stroke-[1.5]" />
                <p className="mt-2 text-xs font-semibold text-slate-600">No pinned messages</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Pin key messages from their hover menu to keep them visible to everyone.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {pinnedMessages.map((pin) => (
                  <div
                    key={pin.id}
                    className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs transition hover:border-slate-300"
                  >
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700 shrink-0">
                          {pin.message_sender_name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <span className="font-semibold text-slate-900 truncate text-[11px]">
                          {pin.message_sender_name || 'Member'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => void unpinMessage(pin.message_id)}
                        className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                        title="Unpin message"
                      >
                        <Pin className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="text-slate-700 text-[11px] bg-white p-2 rounded-lg border border-slate-100 line-clamp-4 break-words">
                      {pin.message_content || '(No text content)'}
                    </p>
                    <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400">
                      <span>Pinned by {pin.pinned_by_name || 'Member'}</span>
                      <span>
                        {new Date(pin.pinned_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                ))}
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

      {/* Modals */}
      {isChannel && (
        <>
          <EditChannelModal
            isOpen={showEditModal}
            onClose={() => setShowEditModal(false)}
            channel={activeConversation}
          />
          <InviteMemberModal
            isOpen={showInviteModal}
            onClose={() => setShowInviteModal(false)}
            channelId={activeConversation.id}
            channelName={activeConversation.name || ''}
            existingMemberIds={members.map((m) => m.user_id)}
            onMemberAdded={loadMembers}
          />
        </>
      )}
    </div>
  );
}

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useWorkspace } from './WorkspaceContext';
import type {
  Conversation,
  WorkspaceMessage,
  UserProfile,
  MessageAttachment,
  MessageReaction,
} from '../types/workspaceChat';
import * as chatService from '../services/chatService';
import { getStickerLabel } from '../components/chat/stickers';
import {
  buildParentPreview,
  getOldestMessageCursor,
  reconcileUnreadCounts,
  resolveActiveConversationId,
} from '../utils/chatHelpers';

interface ChatContextType {
  conversations: Conversation[];
  activeConversation: Conversation | null;
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
  messages: WorkspaceMessage[];
  loadingConversations: boolean;
  loadingMessages: boolean;
  loadingOlderMessages: boolean;
  hasMoreMessages: boolean;
  conversationsError: string | null;
  messagesError: string | null;
  workspaceMembers: UserProfile[];
  onlineUsers: Set<string>;
  typingUsers: Record<string, string>; // userId -> displayName
  unreadCounts: Record<string, number>;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  loadOlderMessages: () => Promise<void>;
  retryLoadMessages: () => Promise<void>;
  sendMessage: (
    content: string,
    options?: {
      parentId?: string | null;
      isSticker?: boolean;
      attachments?: Array<{
        fileName: string;
        fileUrl: string;
        fileType: string;
        fileSize: number;
        storagePath: string;
      }>;
    }
  ) => Promise<void>;
  editMessage: (messageId: string, newContent: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  toggleReaction: (messageId: string, emoji: string) => Promise<void>;
  createChannel: (params: {
    name: string;
    topic?: string;
    description?: string;
    isPrivate: boolean;
  }) => Promise<Conversation>;
  openDM: (targetUserId: string) => Promise<string>;
  joinChannel: (conversationId: string) => Promise<void>;
  leaveChannel: (conversationId: string) => Promise<void>;
  sendTypingIndicator: () => void;
  refreshConversations: () => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<WorkspaceMessage[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [conversationsError, setConversationsError] = useState<string | null>(null);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [workspaceMembers, setWorkspaceMembers] = useState<UserProfile[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');

  // Refs for tracking active subscriptions and latest state without tearing down channels
  const typingTimeoutRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const activeConversationChannelRef = useRef<RealtimeChannel | null>(null);
  const workspacePresenceChannelRef = useRef<RealtimeChannel | null>(null);
  const typingBroadcastChannelRef = useRef<RealtimeChannel | null>(null);
  const workspaceMembersRef = useRef<UserProfile[]>([]);
  const messagesRef = useRef<WorkspaceMessage[]>([]);
  const activeConversationIdRef = useRef<string | null>(null);

  useEffect(() => {
    workspaceMembersRef.current = workspaceMembers;
  }, [workspaceMembers]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  const selectActiveConversation = useCallback((id: string | null) => {
    activeConversationIdRef.current = id;
    setActiveConversationId(id);
  }, []);

  const activeConversation = conversations.find((c) => c.id === activeConversationId) || null;

  // 1. Load workspace members, conversations, and initial unread counts when workspace changes
  const loadWorkspaceData = useCallback(async () => {
    const wsId = currentWorkspace?.id;
    const userId = user?.id;
    if (!wsId || !userId) {
      setConversations([]);
      setWorkspaceMembers([]);
      setUnreadCounts({});
      setConversationsError(null);
      selectActiveConversation(null);
      return;
    }

    setLoadingConversations(true);
    setConversationsError(null);
    try {
      const [members, convList] = await Promise.all([
        chatService.fetchWorkspaceMembers(wsId),
        chatService.fetchWorkspaceConversations(wsId, userId),
      ]);

      setWorkspaceMembers(members);
      setConversations(convList);

      const resolvedActiveId = resolveActiveConversationId(
        activeConversationIdRef.current,
        convList
      );
      if (resolvedActiveId !== activeConversationIdRef.current) {
        selectActiveConversation(resolvedActiveId);
      }

      const initialUnreads = await chatService.fetchInitialUnreadCounts(
        wsId,
        userId,
        convList.map((c) => c.id)
      );
      const latestActiveId = activeConversationIdRef.current ?? resolvedActiveId;
      const isDocumentHidden = typeof document !== 'undefined' && document.hidden;
      setUnreadCounts((prev) =>
        reconcileUnreadCounts({
          initialUnreads,
          activeConversationId: latestActiveId,
          isDocumentHidden,
          previousUnreads: prev,
        })
      );
    } catch (err: unknown) {
      console.error('Error loading chat workspace data:', err);
      const message =
        err instanceof Error ? err.message : 'Unable to load workspace channels and messages.';
      setConversationsError(message);
    } finally {
      setLoadingConversations(false);
    }
  }, [currentWorkspace?.id, user?.id, selectActiveConversation]);

  useEffect(() => {
    void loadWorkspaceData();
  }, [loadWorkspaceData]);

  // Mark active conversation read when user returns to a hidden tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && activeConversationIdRef.current) {
        const activeId = activeConversationIdRef.current;
        void chatService.markConversationRead(activeId);
        setUnreadCounts((prev) => (prev[activeId] ? { ...prev, [activeId]: 0 } : prev));
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // 2. Presence & Workspace-level Realtime Subscriptions
  useEffect(() => {
    const wsId = currentWorkspace?.id;
    const userId = user?.id;
    if (!wsId || !userId) return;

    let isCancelled = false;
    let presenceChannel: RealtimeChannel | null = null;
    let convSubscription: RealtimeChannel | null = null;

    const setupWorkspaceRealtime = async () => {
      try {
        await supabase.realtime.setAuth();
      } catch (err) {
        console.debug('Failed to set Realtime auth token:', err);
      }

      if (isCancelled) return;

      // Private Presence Channel (authorized via realtime.messages RLS)
      const channelName = `presence:${wsId}`;
      presenceChannel = supabase.channel(channelName, {
        config: {
          private: true,
          presence: { key: userId },
        },
      });

      presenceChannel
        .on('presence', { event: 'sync' }, () => {
          if (!presenceChannel) return;
          const state = presenceChannel.presenceState();
          const activeIds = new Set<string>();
          Object.keys(state).forEach((key) => activeIds.add(key));
          setOnlineUsers(activeIds);
        })
        .on('presence', { event: 'join' }, ({ key }) => {
          setOnlineUsers((prev) => new Set(prev).add(key));
        })
        .on('presence', { event: 'leave' }, ({ key }) => {
          setOnlineUsers((prev) => {
            const updated = new Set(prev);
            updated.delete(key);
            return updated;
          });
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED' && presenceChannel && !isCancelled) {
            await presenceChannel.track({
              user_id: userId,
              online_at: new Date().toISOString(),
            });
          }
        });

      workspacePresenceChannelRef.current = presenceChannel;

      // Workspace Conversation Changes & Workspace-wide Unread Counter (RLS-scoped to accessible conversations)
      convSubscription = supabase
        .channel(`conv_changes:${wsId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'conversations',
            filter: `workspace_id=eq.${wsId}`,
          },
          () => {
            void loadWorkspaceData();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `workspace_id=eq.${wsId}`,
          },
          (payload) => {
            const incoming = payload.new as {
              conversation_id?: string;
              sender_id?: string;
              deleted_at?: string | null;
            };
            if (!incoming?.conversation_id || incoming.deleted_at) return;
            if (incoming.sender_id === userId) return;

            const isCurrentlyViewing =
              incoming.conversation_id === activeConversationIdRef.current && !document.hidden;
            if (!isCurrentlyViewing) {
              setUnreadCounts((prev) => ({
                ...prev,
                [incoming.conversation_id!]: (prev[incoming.conversation_id!] || 0) + 1,
              }));
            }
          }
        )
        .subscribe();
    };

    void setupWorkspaceRealtime();

    return () => {
      isCancelled = true;
      presenceChannel?.unsubscribe();
      convSubscription?.unsubscribe();
      workspacePresenceChannelRef.current = null;
    };
  }, [currentWorkspace?.id, user?.id, loadWorkspaceData]);

  // Helper to load latest page of messages for a conversation
  const fetchLatestMessages = useCallback(async (convId: string) => {
    setLoadingMessages(true);
    setMessagesError(null);
    try {
      const { messages: latest, hasMore } = await chatService.fetchConversationMessages(convId, {
        limit: 50,
      });
      if (activeConversationIdRef.current === convId) {
        setMessages(latest);
        setHasMoreMessages(hasMore);
      }
    } catch (err: unknown) {
      console.error('Error fetching messages:', err);
      if (activeConversationIdRef.current === convId) {
        const message =
          err instanceof Error ? err.message : 'Failed to load messages for this conversation.';
        setMessagesError(message);
      }
    } finally {
      if (activeConversationIdRef.current === convId) {
        setLoadingMessages(false);
      }
    }
  }, []);

  const retryLoadMessages = useCallback(async () => {
    if (!activeConversationId) return;
    await fetchLatestMessages(activeConversationId);
  }, [activeConversationId, fetchLatestMessages]);

  const loadOlderMessages = useCallback(async () => {
    if (!activeConversationId || loadingOlderMessages || !hasMoreMessages) return;
    const beforeCursor = getOldestMessageCursor(messagesRef.current);
    if (!beforeCursor) return;

    setLoadingOlderMessages(true);
    try {
      const { messages: older, hasMore } = await chatService.fetchConversationMessages(
        activeConversationId,
        {
          limit: 50,
          beforeCursor,
        }
      );
      if (activeConversationIdRef.current === activeConversationId) {
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const uniqueOlder = older.filter((m) => !existingIds.has(m.id));
          return [...uniqueOlder, ...prev];
        });
        setHasMoreMessages(hasMore);
      }
    } catch (err: unknown) {
      console.error('Error loading older messages:', err);
      const message =
        err instanceof Error ? err.message : 'Failed to load older messages.';
      setMessagesError(message);
    } finally {
      setLoadingOlderMessages(false);
    }
  }, [activeConversationId, loadingOlderMessages, hasMoreMessages]);

  // 3. Load messages & subscribe to Realtime when active conversation changes
  useEffect(() => {
    const userId = user?.id;
    if (!activeConversationId || !userId) {
      setMessages([]);
      setHasMoreMessages(false);
      setMessagesError(null);
      return;
    }

    let isSubscribed = true;
    let convChannel: RealtimeChannel | null = null;
    let typingChannel: RealtimeChannel | null = null;

    setHasMoreMessages(false);
    void fetchLatestMessages(activeConversationId);

    // Mark as read
    void chatService.markConversationRead(activeConversationId);
    setUnreadCounts((prev) => ({ ...prev, [activeConversationId]: 0 }));

    const setupConversationRealtime = async () => {
      try {
        await supabase.realtime.setAuth();
      } catch (err) {
        console.debug('Failed to set Realtime auth token:', err);
      }

      if (!isSubscribed) return;

      // 4. Subscribe to Realtime messages, attachments, and reactions for active conversation
      convChannel = supabase
        .channel(`chat_messages:${activeConversationId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${activeConversationId}`,
          },
          async (payload) => {
            const newMsg = payload.new as WorkspaceMessage;
            const senderProfile = workspaceMembersRef.current.find(
              (m) => m.id === newMsg.sender_id
            ) || {
              id: newMsg.sender_id,
              display_name: 'Member',
              email: '',
              avatar_url: null,
            };

            let hydratedParent: WorkspaceMessage['parent'] = null;
            if (newMsg.parent_id) {
              const localParent = messagesRef.current.find((m) => m.id === newMsg.parent_id);
              if (localParent) {
                hydratedParent = buildParentPreview(
                  {
                    id: localParent.id,
                    content: localParent.content,
                    deleted_at: localParent.deleted_at,
                    is_sticker: localParent.is_sticker,
                    sender_name: localParent.sender?.display_name || 'Member',
                  },
                  getStickerLabel
                );
              } else {
                hydratedParent = await chatService.fetchMessageParentPreview(newMsg.parent_id);
              }
            }

            if (!isSubscribed) return;

            const formattedMsg: WorkspaceMessage = {
              ...newMsg,
              sender: senderProfile,
              parent: hydratedParent,
              attachments: newMsg.attachments || [],
              reactions: newMsg.reactions || [],
            };

            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, formattedMsg];
            });

            if (!document.hidden) {
              void chatService.markConversationRead(activeConversationId);
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${activeConversationId}`,
          },
          (payload) => {
            const updated = payload.new as Partial<WorkspaceMessage> & { id: string };
            setMessages((prev) =>
              prev.map((msg) => {
                if (msg.id !== updated.id) return msg;
                const merged = { ...msg, ...updated };
                if (merged.deleted_at) {
                  merged.attachments = [];
                }
                return merged;
              })
            );
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'message_attachments',
            filter: `conversation_id=eq.${activeConversationId}`,
          },
          async (payload) => {
            const newAtt = payload.new as MessageAttachment;
            if (!newAtt?.message_id) return;

            let signedUrl = chatService.sanitizeAttachmentUrl(newAtt.file_url);
            if (newAtt.storage_path) {
              try {
                signedUrl = await chatService.getSignedAttachmentUrl(newAtt.storage_path);
              } catch (err) {
                console.debug('Failed to sign realtime attachment:', err);
              }
            }

            if (!isSubscribed) return;

            const resolvedAttachment: MessageAttachment = {
              ...newAtt,
              file_url: chatService.sanitizeAttachmentUrl(signedUrl),
            };

            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== resolvedAttachment.message_id || m.deleted_at) return m;
                const existing = m.attachments || [];
                if (existing.some((a) => a.id === resolvedAttachment.id)) return m;
                return { ...m, attachments: [...existing, resolvedAttachment] };
              })
            );
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'message_reactions',
            filter: `conversation_id=eq.${activeConversationId}`,
          },
          (payload) => {
            const reactionRow = payload.new as MessageReaction;
            if (!reactionRow?.message_id) return;

            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== reactionRow.message_id) return m;
                const existing = m.reactions || [];
                if (existing.some((r) => r.id === reactionRow.id)) return m;
                return { ...m, reactions: [...existing, reactionRow] };
              })
            );
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'message_reactions',
          },
          (payload) => {
            // Under RLS, Realtime DELETE payloads only carry primary key (id) and are not filterable by non-PK columns
            const deletedReactionId = (payload.old as { id?: string })?.id;
            if (!deletedReactionId) return;

            setMessages((prev) =>
              prev.map((m) => {
                if (!m.reactions || !m.reactions.some((r) => r.id === deletedReactionId)) {
                  return m;
                }
                return {
                  ...m,
                  reactions: m.reactions.filter((r) => r.id !== deletedReactionId),
                };
              })
            );
          }
        )
        .subscribe();

      activeConversationChannelRef.current = convChannel;

      // 5. Private Broadcast channel for typing indicators (authorized via realtime.messages RLS)
      typingChannel = supabase.channel(`typing:${activeConversationId}`, {
        config: {
          private: true,
        },
      });
      typingChannel
        .on('broadcast', { event: 'typing' }, ({ payload }) => {
          if (!payload?.userId || payload.userId === userId) return;

          const knownMember = workspaceMembersRef.current.find((m) => m.id === payload.userId);
          const resolvedName = knownMember?.display_name || payload.displayName || 'Someone';

          setTypingUsers((prev) => ({
            ...prev,
            [payload.userId]: resolvedName,
          }));

          if (typingTimeoutRef.current[payload.userId]) {
            clearTimeout(typingTimeoutRef.current[payload.userId]);
          }

          typingTimeoutRef.current[payload.userId] = setTimeout(() => {
            setTypingUsers((prev) => {
              const next = { ...prev };
              delete next[payload.userId];
              return next;
            });
          }, 2500);
        })
        .subscribe();

      typingBroadcastChannelRef.current = typingChannel;
    };

    void setupConversationRealtime();

    return () => {
      isSubscribed = false;
      convChannel?.unsubscribe();
      typingChannel?.unsubscribe();
      activeConversationChannelRef.current = null;
      typingBroadcastChannelRef.current = null;
      setTypingUsers({});
      Object.values(typingTimeoutRef.current).forEach((t) => clearTimeout(t));
      typingTimeoutRef.current = {};
    };
  }, [activeConversationId, user?.id, fetchLatestMessages]);

  // Send typing indicator
  const sendTypingIndicator = useCallback(() => {
    if (!typingBroadcastChannelRef.current || !user) return;
    const displayName =
      user.user_metadata?.display_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';

    typingBroadcastChannelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        userId: user.id,
        displayName,
      },
    });
  }, [user]);

  // Send message action
  const sendMessage = async (
    content: string,
    options?: {
      parentId?: string | null;
      isSticker?: boolean;
      attachments?: Array<{
        fileName: string;
        fileUrl: string;
        fileType: string;
        fileSize: number;
        storagePath: string;
      }>;
    }
  ) => {
    if (!currentWorkspace || !activeConversationId || !user) return;

    const sent = await chatService.sendMessage({
      workspaceId: currentWorkspace.id,
      conversationId: activeConversationId,
      senderId: user.id,
      content,
      parentId: options?.parentId,
      isSticker: options?.isSticker,
      attachments: options?.attachments,
    });

    if (sent && activeConversationIdRef.current === activeConversationId) {
      let hydratedParent: WorkspaceMessage['parent'] = null;
      if (sent.parent_id) {
        const localParent = messagesRef.current.find((m) => m.id === sent.parent_id);
        if (localParent) {
          hydratedParent = buildParentPreview(
            {
              id: localParent.id,
              content: localParent.content,
              deleted_at: localParent.deleted_at,
              is_sticker: localParent.is_sticker,
              sender_name: localParent.sender?.display_name || 'Member',
            },
            getStickerLabel
          );
        }
      }
      const messageWithParent: WorkspaceMessage = {
        ...sent,
        parent: hydratedParent,
      };
      setMessages((prev) => {
        if (prev.some((m) => m.id === messageWithParent.id)) return prev;
        return [...prev, messageWithParent];
      });
    }
  };

  const editMessage = async (messageId: string, newContent: string) => {
    await chatService.editMessage(messageId, newContent);
  };

  const deleteMessage = async (messageId: string) => {
    await chatService.deleteMessage(messageId);
    const deletedAt = new Date().toISOString();
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId
          ? {
              ...msg,
              deleted_at: msg.deleted_at || deletedAt,
              content: 'This message was deleted.',
              attachments: [],
            }
          : msg
      )
    );
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!currentWorkspace || !activeConversationId || !user) return;
    await chatService.toggleReaction({
      messageId,
      conversationId: activeConversationId,
      workspaceId: currentWorkspace.id,
      userId: user.id,
      emoji,
    });
  };

  const createChannel = async (params: {
    name: string;
    topic?: string;
    description?: string;
    isPrivate: boolean;
  }) => {
    if (!currentWorkspace || !user) throw new Error('No active workspace');
    const newChan = await chatService.createChannel({
      workspaceId: currentWorkspace.id,
      name: params.name,
      topic: params.topic,
      description: params.description,
      isPrivate: params.isPrivate,
      createdBy: user.id,
    });

    await loadWorkspaceData();
    selectActiveConversation(newChan.id);
    return newChan;
  };

  const openDM = async (targetUserId: string): Promise<string> => {
    if (!currentWorkspace || !user) throw new Error('No active workspace');
    const dmId = await chatService.getOrCreateDM(currentWorkspace.id, targetUserId);
    await loadWorkspaceData();
    selectActiveConversation(dmId);
    return dmId;
  };

  const joinChannel = async (conversationId: string) => {
    if (!user) return;
    await chatService.joinChannel(conversationId, user.id);
    await loadWorkspaceData();
  };

  const leaveChannel = async (conversationId: string) => {
    if (!user) return;
    await chatService.leaveChannel(conversationId, user.id);
    await loadWorkspaceData();
    // Default to general
    const general = conversations.find((c) => c.name === 'general');
    if (general) selectActiveConversation(general.id);
  };

  return (
    <ChatContext.Provider
      value={{
        conversations,
        activeConversation,
        activeConversationId,
        setActiveConversationId: selectActiveConversation,
        messages,
        loadingConversations,
        loadingMessages,
        loadingOlderMessages,
        hasMoreMessages,
        conversationsError,
        messagesError,
        workspaceMembers,
        onlineUsers,
        typingUsers,
        unreadCounts,
        searchQuery,
        setSearchQuery,
        loadOlderMessages,
        retryLoadMessages,
        sendMessage,
        editMessage,
        deleteMessage,
        toggleReaction,
        createChannel,
        openDM,
        joinChannel,
        leaveChannel,
        sendTypingIndicator,
        refreshConversations: loadWorkspaceData,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used inside a ChatProvider');
  }
  return context;
}

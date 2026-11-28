import { supabase } from '../lib/supabase';
import { getApiUrl } from '../lib/api';
import { getStickerLabel } from '../components/chat/stickers';
import {
  SIGNED_URL_TTL_SECONDS,
  buildCompositeBeforeCursorFilter,
  buildParentPreview,
  computeInitialUnreadCounts,
  createLinkPreviewLoader,
  hydrateMessageParents,
  normalizeDescMessagePage,
  sanitizeAttachmentUrl,
  type MessageCursor,
  type ParentSourceRecord,
} from '../utils/chatHelpers';
import type {
  Conversation,
  WorkspaceMessage,
  MessageAttachment,
  MessageReaction,
  ConversationMember,
  UserProfile,
  LinkPreviewData,
  ChannelDiscoveryItem,
  ChatMessageSearchResult,
  PinnedMessageItem,
} from '../types/workspaceChat';

export { sanitizeAttachmentUrl };

interface ProfileRelation {
  id?: string;
  display_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
}

interface WorkspaceMemberQueryRow {
  user_id: string;
  role: string;
  profiles?: ProfileRelation | null;
}

interface DmMemberQueryRow {
  conversation_id: string;
  user_id: string;
  last_read_at?: string;
  profiles?: ProfileRelation | null;
}

interface MessageQueryRow extends Omit<WorkspaceMessage, 'sender' | 'attachments' | 'reactions'> {
  sender?: ProfileRelation | null;
  attachments?: MessageAttachment[];
  reactions?: MessageReaction[];
}

interface ConversationMemberQueryRow {
  conversation_id: string;
  user_id: string;
  joined_at: string;
  last_read_at: string;
  profiles?: ProfileRelation | null;
}

const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const DISALLOWED_EXTENSIONS = [
  '.exe',
  '.bat',
  '.cmd',
  '.sh',
  '.msi',
  '.dll',
  '.com',
  '.vbs',
  '.ps1',
  '.svg',
];

const LINK_PREVIEW_CACHE_MAX = 200;

async function resolveAuthToken(explicitToken?: string): Promise<string | undefined> {
  if (explicitToken) return explicitToken;
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.access_token) {
      return data.session.access_token;
    }
  } catch {
    // ignore session read errors
  }
  try {
    const raw = localStorage.getItem('actionpulse_dev_session');
    if (raw) {
      const parsed = JSON.parse(raw) as { access_token?: string };
      return parsed.access_token;
    }
  } catch {
    // ignore localStorage errors
  }
  return undefined;
}

const linkPreviewLoader = createLinkPreviewLoader(async (normalizedUrl, token) => {
  const authToken = await resolveAuthToken(token);
  const headers: Record<string, string> = {};
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const endpoint = getApiUrl(`/api/chat/link-preview?url=${encodeURIComponent(normalizedUrl)}`);
  const resp = await fetch(endpoint, { headers });
  if (!resp.ok) {
    return { status: resp.status, data: null };
  }
  const data = (await resp.json()) as LinkPreviewData;
  return { status: resp.status, data };
}, LINK_PREVIEW_CACHE_MAX);

export async function fetchWorkspaceMembers(workspaceId: string): Promise<UserProfile[]> {
  const { data, error } = await supabase
    .from('workspace_members')
    .select(`
      user_id,
      role,
      profiles:user_id (
        id,
        display_name,
        email,
        avatar_url
      )
    `)
    .eq('workspace_id', workspaceId);

  if (error) throw error;

  return ((data || []) as unknown as WorkspaceMemberQueryRow[]).map((row) => {
    const p = row.profiles;
    return {
      id: row.user_id,
      display_name: p?.display_name || p?.email?.split('@')[0] || 'Unknown User',
      email: p?.email || '',
      avatar_url: p?.avatar_url || null,
    };
  });
}

export async function fetchWorkspaceConversations(
  workspaceId: string,
  currentUserId: string
): Promise<Conversation[]> {
  // 1. Fetch conversations accessible to user
  const { data: convData, error: convError } = await supabase
    .from('conversations')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('updated_at', { ascending: false });

  if (convError) throw convError;

  const conversations = (convData || []) as Conversation[];

  // 2. Fetch all DM members for this workspace to resolve other user's identity
  const dmConvIds = conversations.filter((c) => c.type === 'dm').map((c) => c.id);
  const dmMembersListMap: Record<string, UserProfile[]> = {};

  if (dmConvIds.length > 0) {
    const { data: memberData } = await supabase
      .from('conversation_members')
      .select(`
        conversation_id,
        user_id,
        last_read_at,
        profiles:user_id (
          id,
          display_name,
          email,
          avatar_url
        )
      `)
      .in('conversation_id', dmConvIds);

    ((memberData || []) as unknown as DmMemberQueryRow[]).forEach((row) => {
      if (row.user_id !== currentUserId) {
        const p = row.profiles;
        if (!dmMembersListMap[row.conversation_id]) {
          dmMembersListMap[row.conversation_id] = [];
        }
        dmMembersListMap[row.conversation_id].push({
          id: row.user_id,
          display_name: p?.display_name || p?.email?.split('@')[0] || 'User',
          email: p?.email || '',
          avatar_url: p?.avatar_url || null,
        });
      }
    });
  }

  // 3. Attach other_user / other_users info to DMs
  return conversations.map((conv) => {
    if (conv.type === 'dm') {
      const otherUsers = dmMembersListMap[conv.id] || [];
      const otherUser = otherUsers[0];
      const isGroup = otherUsers.length > 1;
      let displayName = conv.topic || conv.name;
      if (!displayName || displayName.startsWith('gdm:')) {
        displayName = isGroup
          ? otherUsers.map((u) => u.display_name).join(', ')
          : otherUser
          ? (otherUser.display_name || 'Direct Message')
          : 'Direct Message';
      }
      return {
        ...conv,
        other_user: otherUser,
        other_users: otherUsers,
        name: displayName,
      };
    }
    return conv;
  });
}

export async function fetchInitialUnreadCounts(
  workspaceId: string,
  currentUserId: string,
  conversationIds: string[]
): Promise<Record<string, number>> {
  if (conversationIds.length === 0) return {};

  try {
    const [{ data: memberRows }, { data: recentMessages }] = await Promise.all([
      supabase
        .from('conversation_members')
        .select('conversation_id, last_read_at')
        .eq('user_id', currentUserId)
        .in('conversation_id', conversationIds),
      supabase
        .from('messages')
        .select('conversation_id, sender_id, created_at, deleted_at')
        .eq('workspace_id', workspaceId)
        .is('deleted_at', null)
        .neq('sender_id', currentUserId)
        .order('created_at', { ascending: false })
        .limit(500),
    ]);

    const lastReadByConv: Record<string, string> = {};
    (memberRows || []).forEach((row: { conversation_id: string; last_read_at: string }) => {
      if (row.conversation_id && row.last_read_at) {
        lastReadByConv[row.conversation_id] = row.last_read_at;
      }
    });

    return computeInitialUnreadCounts({
      currentUserId,
      conversationIds,
      lastReadByConv,
      recentMessages: (recentMessages || []) as Array<{
        conversation_id: string;
        sender_id: string;
        created_at: string;
        deleted_at?: string | null;
      }>,
    });
  } catch (err) {
    console.debug('Failed to compute initial unread counts:', err);
    return {};
  }
}

export interface FetchMessagesResult {
  messages: WorkspaceMessage[];
  hasMore: boolean;
}

export async function fetchConversationMessages(
  conversationId: string,
  options: { limit?: number; beforeCursor?: MessageCursor } = {}
): Promise<FetchMessagesResult> {
  const limit = options.limit ?? 50;

  let query = supabase
    .from('messages')
    .select(`
      *,
      sender:profiles!sender_id (
        id,
        display_name,
        email,
        avatar_url
      ),
      attachments:message_attachments (
        id,
        message_id,
        conversation_id,
        workspace_id,
        file_name,
        file_url,
        file_type,
        file_size,
        storage_path,
        created_at
      ),
      reactions:message_reactions (
        id,
        message_id,
        conversation_id,
        workspace_id,
        user_id,
        emoji,
        created_at
      )
    `)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1);

  if (options.beforeCursor) {
    query = query.or(buildCompositeBeforeCursorFilter(options.beforeCursor));
  }

  const { data, error } = await query;
  if (error) throw error;

  const rawDesc = (data || []) as unknown as MessageQueryRow[];
  const { items: rawMessages, hasMore } = normalizeDescMessagePage(rawDesc, limit);

  // Batch resolve authorized signed URLs (15-minute TTL) for non-deleted private attachments
  const storagePaths: string[] = [];
  rawMessages.forEach((msg) => {
    if (msg.deleted_at) return;
    (msg.attachments || []).forEach((att) => {
      if (att.storage_path) {
        storagePaths.push(att.storage_path);
      }
    });
  });

  const signedUrlsMap: Record<string, string> = {};
  if (storagePaths.length > 0) {
    try {
      const { data: signedResults } = await supabase.storage
        .from('chat-attachments')
        .createSignedUrls(storagePaths, SIGNED_URL_TTL_SECONDS);

      (signedResults || []).forEach((res) => {
        if (res.signedUrl && res.path) {
          signedUrlsMap[res.path] = res.signedUrl;
        }
      });
    } catch (signErr) {
      console.debug('Batch signed URL generation failed:', signErr);
    }
  }

  const mappedMessages: WorkspaceMessage[] = rawMessages.map((msg) => ({
    ...msg,
    sender: {
      id: msg.sender_id,
      display_name: msg.sender?.display_name || msg.sender?.email?.split('@')[0] || 'User',
      email: msg.sender?.email || '',
      avatar_url: msg.sender?.avatar_url || null,
    },
    attachments: msg.deleted_at
      ? []
      : (msg.attachments || []).map((att) => ({
          ...att,
          file_url: sanitizeAttachmentUrl(signedUrlsMap[att.storage_path] || att.file_url),
        })),
    reactions: msg.reactions || [],
  }));

  // Hydrate reply parent previews (resolving parents outside the current page if needed)
  const localIds = new Set(mappedMessages.map((m) => m.id));
  const missingParentIds = Array.from(
    new Set(
      mappedMessages
        .map((m) => m.parent_id)
        .filter((pid): pid is string => Boolean(pid && !localIds.has(pid)))
    )
  );

  const externalParents: Record<string, ParentSourceRecord> = {};
  if (missingParentIds.length > 0) {
    try {
      const { data: parentRows } = await supabase
        .from('messages')
        .select(`
          id,
          content,
          deleted_at,
          is_sticker,
          sender:profiles!sender_id (
            display_name,
            email
          )
        `)
        .in('id', missingParentIds);

      ((parentRows || []) as unknown as Array<{
        id: string;
        content: string;
        deleted_at?: string | null;
        is_sticker?: boolean;
        sender?: ProfileRelation | null;
      }>).forEach((p) => {
        externalParents[p.id] = {
          id: p.id,
          content: p.content,
          deleted_at: p.deleted_at,
          is_sticker: p.is_sticker,
          sender_name: p.sender?.display_name || p.sender?.email?.split('@')[0] || 'Member',
        };
      });
    } catch (parentErr) {
      console.debug('Failed to hydrate external reply parents:', parentErr);
    }
  }

  return {
    messages: hydrateMessageParents(mappedMessages, externalParents, getStickerLabel),
    hasMore,
  };
}

export async function fetchMessageParentPreview(
  parentId: string
): Promise<{ id: string; content: string; sender_name: string } | null> {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select(`
        id,
        content,
        deleted_at,
        is_sticker,
        sender:profiles!sender_id (
          display_name,
          email
        )
      `)
      .eq('id', parentId)
      .maybeSingle();

    if (error || !data) return null;
    const row = data as unknown as {
      id: string;
      content: string;
      deleted_at?: string | null;
      is_sticker?: boolean;
      sender?: ProfileRelation | null;
    };

    return buildParentPreview(
      {
        id: row.id,
        content: row.content,
        deleted_at: row.deleted_at,
        is_sticker: row.is_sticker,
        sender_name: row.sender?.display_name || row.sender?.email?.split('@')[0] || 'Member',
      },
      getStickerLabel
    );
  } catch {
    return null;
  }
}

export async function sendMessage(params: {
  workspaceId: string;
  conversationId: string;
  senderId: string;
  content: string;
  parentId?: string | null;
  isSticker?: boolean;
  attachments?: Array<{
    fileName: string;
    fileUrl: string;
    fileType: string;
    fileSize: number;
    storagePath: string;
  }>;
}): Promise<WorkspaceMessage | null> {
  try {
    const { workspaceId, conversationId, senderId, content, parentId, isSticker, attachments } = params;

    const trimmedContent = content.trim();
    const effectiveContent =
      trimmedContent ||
      (attachments && attachments.length > 0
        ? attachments.length === 1
          ? `Shared ${attachments[0].fileName}`
          : `Shared ${attachments.length} attachments`
        : '');

    const { data: msgData, error: msgError } = await supabase
      .from('messages')
      .insert({
        workspace_id: workspaceId,
        conversation_id: conversationId,
        sender_id: senderId,
        content: effectiveContent,
        parent_id: parentId || null,
        is_sticker: Boolean(isSticker),
      })
      .select(`
        *,
        sender:profiles!sender_id (
          id,
          display_name,
          email,
          avatar_url
        )
      `)
      .single();

    if (msgError) throw msgError;

    let savedAttachments: MessageAttachment[] = [];
    if (attachments && attachments.length > 0) {
      const signedByPath: Record<string, string> = {};
      const attachRows = attachments.map((att) => {
        signedByPath[att.storagePath] = sanitizeAttachmentUrl(att.fileUrl);
        return {
          message_id: msgData.id,
          conversation_id: conversationId,
          workspace_id: workspaceId,
          file_name: att.fileName,
          file_url: '',
          file_type: att.fileType,
          file_size: att.fileSize,
          storage_path: att.storagePath,
        };
      });

      const { data: attData, error: attError } = await supabase
        .from('message_attachments')
        .insert(attachRows)
        .select('*');

      if (attError) {
        throw attError;
      }

      if (attData) {
        savedAttachments = (attData as MessageAttachment[]).map((att) => ({
          ...att,
          file_url: signedByPath[att.storage_path] || sanitizeAttachmentUrl(att.file_url),
        }));
      }
    }

    return {
      ...msgData,
      sender: {
        id: msgData.sender_id,
        display_name: msgData.sender?.display_name || msgData.sender?.email?.split('@')[0] || 'User',
        email: msgData.sender?.email || '',
        avatar_url: msgData.sender?.avatar_url || null,
      },
      attachments: savedAttachments,
      reactions: [],
    };
  } catch (err) {
    console.error('Failed to send message:', err);
    throw err;
  }
}

export async function editMessage(messageId: string, newContent: string): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .update({
      content: newContent.trim(),
    })
    .eq('id', messageId);

  if (error) throw error;
}

export async function deleteMessage(messageId: string): Promise<void> {
  const authToken = await resolveAuthToken();
  const headers: Record<string, string> = {};
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const endpoint = getApiUrl(`/api/chat/messages/${encodeURIComponent(messageId)}`);
  const resp = await fetch(endpoint, {
    method: 'DELETE',
    headers,
  });

  if (!resp.ok) {
    let detail = `Failed to delete message (${resp.status})`;
    try {
      const body = (await resp.json()) as { detail?: string };
      if (body?.detail) {
        detail = body.detail;
      }
    } catch {
      // ignore non-JSON error bodies
    }
    throw new Error(detail);
  }
}

export async function toggleReaction(params: {
  messageId: string;
  conversationId: string;
  workspaceId: string;
  userId: string;
  emoji: string;
}): Promise<void> {
  const { messageId, conversationId, workspaceId, userId, emoji } = params;

  // Check if reaction already exists
  const { data: existing } = await supabase
    .from('message_reactions')
    .select('id')
    .eq('message_id', messageId)
    .eq('user_id', userId)
    .eq('emoji', emoji)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from('message_reactions').delete().eq('id', existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('message_reactions').insert({
      message_id: messageId,
      conversation_id: conversationId,
      workspace_id: workspaceId,
      user_id: userId,
      emoji: emoji,
    });
    if (error) throw error;
  }
}

export async function getOrCreateDM(workspaceId: string, targetUserId: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_or_create_dm_conversation', {
    p_workspace_id: workspaceId,
    p_target_user_id: targetUserId,
  });

  if (error) throw error;
  return data as string;
}

export async function createChannel(params: {
  workspaceId: string;
  name: string;
  topic?: string;
  description?: string;
  isPrivate: boolean;
  createdBy?: string;
}): Promise<Conversation> {
  const cleanName = params.name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '');

  const { data, error } = await supabase.rpc('create_channel', {
    p_workspace_id: params.workspaceId,
    p_name: cleanName,
    p_topic: params.topic || null,
    p_description: params.description || null,
    p_is_private: params.isPrivate,
  });

  if (error) throw error;
  return data as Conversation;
}

export async function joinChannel(conversationId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('conversation_members').insert({
    conversation_id: conversationId,
    user_id: userId,
  });
  if (error && error.code !== '23505') throw error;
}

export async function joinPublicChannel(channelId: string): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  const res = await fetch(getApiUrl(`/api/chat/channels/${channelId}/join`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(typeof data.detail === 'string' ? data.detail : `Error ${res.status}: Failed to join channel`);
  }
}

export async function discoverPublicChannels(workspaceId: string, query?: string): Promise<ChannelDiscoveryItem[]> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  const url = getApiUrl(
    `/api/chat/workspaces/${workspaceId}/channels/discover${query ? `?q=${encodeURIComponent(query)}` : ''}`
  );
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(typeof data.detail === 'string' ? data.detail : `Error ${res.status}: Failed to discover channels`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function updateChannelDetails(
  channelId: string,
  params: { name?: string; topic?: string; description?: string; isPrivate?: boolean }
): Promise<Conversation> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  const res = await fetch(getApiUrl(`/api/chat/channels/${channelId}`), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      name: params.name,
      topic: params.topic,
      description: params.description,
      is_private: params.isPrivate,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.detail === 'string' ? data.detail : `Error ${res.status}: Failed to update channel`);
  }
  return data as Conversation;
}

export async function addChannelMember(channelId: string, userId: string): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  const res = await fetch(getApiUrl(`/api/chat/channels/${channelId}/members`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ user_id: userId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(typeof data.detail === 'string' ? data.detail : `Error ${res.status}: Failed to add member`);
  }
}

export async function removeChannelMember(channelId: string, userId: string): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  const res = await fetch(getApiUrl(`/api/chat/channels/${channelId}/members/${userId}`), {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(typeof data.detail === 'string' ? data.detail : `Error ${res.status}: Failed to remove member`);
  }
}

export async function leaveChannel(conversationId: string, userId: string): Promise<void> {
  return removeChannelMember(conversationId, userId);
}

export async function fetchConversationMembers(conversationId: string): Promise<ConversationMember[]> {
  const { data, error } = await supabase
    .from('conversation_members')
    .select(`
      conversation_id,
      user_id,
      joined_at,
      last_read_at,
      profiles:user_id (
        id,
        display_name,
        email,
        avatar_url
      )
    `)
    .eq('conversation_id', conversationId);

  if (error) throw error;

  return ((data || []) as unknown as ConversationMemberQueryRow[]).map((row) => ({
    conversation_id: row.conversation_id,
    user_id: row.user_id,
    joined_at: row.joined_at,
    last_read_at: row.last_read_at,
    profile: {
      id: row.user_id,
      display_name: row.profiles?.display_name || row.profiles?.email?.split('@')[0] || 'User',
      email: row.profiles?.email || '',
      avatar_url: row.profiles?.avatar_url || null,
    },
  }));
}

export async function markConversationRead(conversationId: string): Promise<void> {
  try {
    await supabase.rpc('mark_conversation_read', { p_conversation_id: conversationId });
  } catch (err) {
    // Graceful fallback
    console.debug('mark_conversation_read failed:', err);
  }
}

export async function uploadChatAttachment(
  workspaceId: string,
  conversationId: string,
  file: File
): Promise<{ fileName: string; fileUrl: string; fileType: string; fileSize: number; storagePath: string }> {
  // Validate file size (10MB max)
  const MAX_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    throw new Error('File exceeds the 10MB upload limit.');
  }

  // Validate extension
  const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
  if (DISALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error('Executable or dangerous file types are prohibited.');
  }

  // Validate MIME type
  if (file.type && !ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error(`File type ${file.type} is not supported.`);
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = `${workspaceId}/${conversationId}/${Date.now()}_${safeName}`;

  const { data, error } = await supabase.storage
    .from('chat-attachments')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) throw error;

  // Generate an authenticated signed URL (valid for 15 minutes)
  const { data: signedData, error: signedError } = await supabase.storage
    .from('chat-attachments')
    .createSignedUrl(data.path, SIGNED_URL_TTL_SECONDS);

  const fileUrl = signedData?.signedUrl || '';
  if (signedError && !fileUrl) {
    throw new Error('Could not create secure download URL for uploaded file.');
  }

  return {
    fileName: file.name,
    fileUrl,
    fileType: file.type || 'application/octet-stream',
    fileSize: file.size,
    storagePath: data.path,
  };
}

export async function getSignedAttachmentUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('chat-attachments')
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    throw error || new Error('Failed to generate signed URL');
  }

  return data.signedUrl;
}

export async function fetchLinkPreview(url: string, token?: string): Promise<LinkPreviewData | null> {
  return linkPreviewLoader.load(url, token);
}

export async function searchWorkspaceMessages(
  workspaceId: string,
  query: string,
  conversationId?: string,
  token?: string
): Promise<ChatMessageSearchResult[]> {
  const authToken = token || (await supabase.auth.getSession()).data.session?.access_token;
  const params = new URLSearchParams({ q: query.trim() });
  if (conversationId) {
    params.append('conversation_id', conversationId);
  }
  const endpoint = getApiUrl(`/api/chat/workspaces/${workspaceId}/search?${params.toString()}`);
  const res = await fetch(endpoint, {
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Search failed: ${res.statusText}`);
  }
  return res.json();
}

export async function createGroupConversation(params: {
  workspaceId: string;
  participantIds: string[];
  name?: string;
  token?: string;
}): Promise<Conversation> {
  const authToken = params.token || (await supabase.auth.getSession()).data.session?.access_token;
  const endpoint = getApiUrl(`/api/chat/workspaces/${params.workspaceId}/group-conversations`);
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify({
      participant_ids: params.participantIds,
      name: params.name || null,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to create group conversation' }));
    throw new Error(err.detail || 'Failed to create group conversation');
  }
  return res.json();
}

export async function pinMessage(messageId: string, token?: string): Promise<void> {
  const authToken = token || (await supabase.auth.getSession()).data.session?.access_token;
  const endpoint = getApiUrl(`/api/chat/messages/${encodeURIComponent(messageId)}/pin`);
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
  });
  if (!res.ok) {
    throw new Error('Failed to pin message');
  }
}

export async function unpinMessage(messageId: string, token?: string): Promise<void> {
  const authToken = token || (await supabase.auth.getSession()).data.session?.access_token;
  const endpoint = getApiUrl(`/api/chat/messages/${encodeURIComponent(messageId)}/pin`);
  const res = await fetch(endpoint, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
  });
  if (!res.ok) {
    throw new Error('Failed to unpin message');
  }
}

export async function fetchPinnedMessages(conversationId: string, token?: string): Promise<PinnedMessageItem[]> {
  const authToken = token || (await supabase.auth.getSession()).data.session?.access_token;
  const endpoint = getApiUrl(`/api/chat/conversations/${encodeURIComponent(conversationId)}/pins`);
  const res = await fetch(endpoint, {
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch pinned messages');
  }
  return res.json();
}


import type { LinkPreviewData, WorkspaceMessage } from '../types/workspaceChat';

export const SIGNED_URL_TTL_SECONDS = 900;

export interface MessageCursor {
  createdAt: string;
  id: string;
}

export interface ParentSourceRecord {
  id: string;
  content: string;
  deleted_at?: string | null;
  is_sticker?: boolean;
  sender_name: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/i;

export function sanitizeAttachmentUrl(url?: string | null): string {
  if (!url) return '';
  const trimmed = url.trim();
  return /^https:\/\//i.test(trimmed) ? trimmed : '';
}

export function extractFirstUrl(content: string): string | null {
  if (!content) return null;
  const match = content.match(/https?:\/\/[^\s<>()]+/i);
  if (!match) return null;
  const cleaned = match[0].replace(/[.,!?;:'"]+$/, '');
  return /^https?:\/\/[^\s]+$/i.test(cleaned) ? cleaned : null;
}

export function extractSafeHostname(url: string): string {
  try {
    return new URL(url).hostname || url;
  } catch {
    return url;
  }
}

export function shouldNegativelyCacheLinkPreviewStatus(status: number): boolean {
  return status === 400 || status === 404;
}

export interface LinkPreviewFetchResult {
  status: number;
  data: LinkPreviewData | null;
}

export function createLinkPreviewLoader(
  fetcher: (normalizedUrl: string, token?: string) => Promise<LinkPreviewFetchResult>,
  maxEntries = 200
) {
  const cache = new Map<string, LinkPreviewData | null>();
  const inflight = new Map<string, Promise<LinkPreviewData | null>>();

  const setCache = (key: string, value: LinkPreviewData | null) => {
    if (cache.size >= maxEntries) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey) cache.delete(oldestKey);
    }
    cache.set(key, value);
  };

  const load = async (url: string, token?: string): Promise<LinkPreviewData | null> => {
    const normalizedUrl = url.trim();
    if (!/^https?:\/\//i.test(normalizedUrl)) return null;

    if (cache.has(normalizedUrl)) {
      return cache.get(normalizedUrl) ?? null;
    }

    const existing = inflight.get(normalizedUrl);
    if (existing) {
      return existing;
    }

    const promise = (async (): Promise<LinkPreviewData | null> => {
      try {
        const res = await fetcher(normalizedUrl, token);
        if (res.status >= 200 && res.status < 300) {
          const data = res.data;
          const result = data && (data.title || data.description || data.image) ? data : null;
          setCache(normalizedUrl, result);
          return result;
        }
        if (shouldNegativelyCacheLinkPreviewStatus(res.status)) {
          setCache(normalizedUrl, null);
        }
        return null;
      } catch {
        // Transient network error: do not cache so later retries can succeed
        return null;
      } finally {
        inflight.delete(normalizedUrl);
      }
    })();

    inflight.set(normalizedUrl, promise);
    return promise;
  };

  return {
    load,
    clear: () => {
      cache.clear();
      inflight.clear();
    },
    hasCached: (url: string) => cache.has(url.trim()),
  };
}

export function buildCompositeBeforeCursorFilter(cursor: MessageCursor): string {
  const rawCreatedAt = cursor.createdAt.trim();
  const id = cursor.id.trim();

  if (!ISO_TIMESTAMP_PATTERN.test(rawCreatedAt) || Number.isNaN(Date.parse(rawCreatedAt))) {
    throw new Error('Invalid composite pagination cursor timestamp.');
  }
  if (!UUID_PATTERN.test(id)) {
    throw new Error('Invalid composite pagination cursor id.');
  }

  // Replace space separator with T while preserving exact Postgres sub-millisecond precision
  const createdAt = rawCreatedAt.replace(' ', 'T');
  return `created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${id})`;
}

export function getOldestMessageCursor<T extends { created_at: string; id: string }>(
  chronologicalMessages: T[]
): MessageCursor | null {
  const oldest = chronologicalMessages[0];
  if (!oldest?.created_at || !oldest?.id) return null;
  return { createdAt: oldest.created_at, id: oldest.id };
}

export function normalizeDescMessagePage<T>(
  rowsDesc: T[],
  limit: number
): { items: T[]; hasMore: boolean } {
  const safeLimit = Math.max(1, limit);
  const hasMore = rowsDesc.length > safeLimit;
  const pageSlice = hasMore ? rowsDesc.slice(0, safeLimit) : rowsDesc.slice();
  return {
    items: pageSlice.reverse(),
    hasMore,
  };
}

export function resolveActiveConversationId(
  currentActiveId: string | null,
  conversations: Array<{ id: string; name?: string | null }>
): string | null {
  if (currentActiveId && conversations.some((c) => c.id === currentActiveId)) {
    return currentActiveId;
  }
  const general = conversations.find((c) => c.name === 'general') || conversations[0];
  return general ? general.id : null;
}

export function reconcileUnreadCounts(params: {
  initialUnreads: Record<string, number>;
  activeConversationId: string | null;
  isDocumentHidden: boolean;
  previousUnreads?: Record<string, number>;
}): Record<string, number> {
  const { initialUnreads, activeConversationId, isDocumentHidden, previousUnreads = {} } = params;
  const next: Record<string, number> = { ...initialUnreads };

  if (!activeConversationId) {
    return next;
  }

  if (!isDocumentHidden) {
    next[activeConversationId] = 0;
  } else {
    const serverCount = next[activeConversationId] ?? 0;
    const prevCount = previousUnreads[activeConversationId] ?? 0;
    next[activeConversationId] = Math.max(serverCount, prevCount);
  }

  return next;
}

export function buildParentPreview(
  parent: ParentSourceRecord,
  stickerLabelResolver?: (stickerId: string) => string | undefined
): { id: string; content: string; sender_name: string } {
  let previewText = parent.content;
  if (parent.deleted_at) {
    previewText = 'This message was deleted.';
  } else if (parent.is_sticker && stickerLabelResolver) {
    previewText = stickerLabelResolver(parent.content) || parent.content;
  }

  return {
    id: parent.id,
    content: previewText,
    sender_name: parent.sender_name || 'Member',
  };
}

export function hydrateMessageParents(
  messages: WorkspaceMessage[],
  externalParents: Record<string, ParentSourceRecord> = {},
  stickerLabelResolver?: (stickerId: string) => string | undefined
): WorkspaceMessage[] {
  const localById: Record<string, ParentSourceRecord> = {};
  for (const m of messages) {
    localById[m.id] = {
      id: m.id,
      content: m.content,
      deleted_at: m.deleted_at,
      is_sticker: m.is_sticker,
      sender_name: m.sender?.display_name || 'Member',
    };
  }

  return messages.map((msg) => {
    if (!msg.parent_id) return msg;
    const parentSource = localById[msg.parent_id] || externalParents[msg.parent_id];
    if (!parentSource) return msg;
    return {
      ...msg,
      parent: buildParentPreview(parentSource, stickerLabelResolver),
    };
  });
}

export function computeInitialUnreadCounts(params: {
  currentUserId: string;
  conversationIds: string[];
  lastReadByConv: Record<string, string>;
  recentMessages: Array<{
    conversation_id: string;
    sender_id: string;
    created_at: string;
    deleted_at?: string | null;
  }>;
}): Record<string, number> {
  const { currentUserId, conversationIds, lastReadByConv, recentMessages } = params;
  const allowed = new Set(conversationIds);
  const counts: Record<string, number> = {};

  for (const convId of conversationIds) {
    counts[convId] = 0;
  }

  for (const msg of recentMessages) {
    if (!allowed.has(msg.conversation_id)) continue;
    if (msg.deleted_at) continue;
    if (msg.sender_id === currentUserId) continue;

    const lastReadIso = lastReadByConv[msg.conversation_id];
    if (!lastReadIso) {
      counts[msg.conversation_id] = (counts[msg.conversation_id] || 0) + 1;
      continue;
    }

    const msgTs = Date.parse(msg.created_at);
    const readTs = Date.parse(lastReadIso);
    if (!Number.isNaN(msgTs) && !Number.isNaN(readTs) && msgTs > readTs) {
      counts[msg.conversation_id] = (counts[msg.conversation_id] || 0) + 1;
    }
  }

  return counts;
}


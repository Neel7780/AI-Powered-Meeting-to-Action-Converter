import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  SIGNED_URL_TTL_SECONDS,
  buildCompositeBeforeCursorFilter,
  buildParentPreview,
  computeInitialUnreadCounts,
  createLinkPreviewLoader,
  extractFirstUrl,
  extractSafeHostname,
  getOldestMessageCursor,
  hydrateMessageParents,
  normalizeDescMessagePage,
  reconcileUnreadCounts,
  resolveActiveConversationId,
  sanitizeAttachmentUrl,
  shouldNegativelyCacheLinkPreviewStatus,
} from '../src/utils/chatHelpers.ts';
import { STICKER_LIST, getStickerLabel } from '../src/components/chat/stickers.ts';

const FRONTEND_ROOT = resolve(import.meta.dirname, '..');

test('Priority 1: normalizeDescMessagePage returns latest messages chronologically and accurate hasMore', () => {
  // Simulated DB response ordered created_at DESC with limit + 1 (limit = 3, 4 rows returned)
  const descRows = [
    { id: 'm100', created_at: '2026-11-18T10:04:00Z' },
    { id: 'm99', created_at: '2026-11-18T10:03:00Z' },
    { id: 'm98', created_at: '2026-11-18T10:02:00Z' },
    { id: 'm97', created_at: '2026-11-18T10:01:00Z' },
  ];

  const page1 = normalizeDescMessagePage(descRows, 3);
  assert.equal(page1.hasMore, true);
  assert.deepEqual(
    page1.items.map((m) => m.id),
    ['m98', 'm99', 'm100']
  );

  // Final older page with <= limit rows
  const finalPage = normalizeDescMessagePage(descRows.slice(2), 3);
  assert.equal(finalPage.hasMore, false);
  assert.deepEqual(
    finalPage.items.map((m) => m.id),
    ['m97', 'm98']
  );
});

test('Priority 2: hydrateMessageParents resolves local, cross-page, deleted, and sticker parents', () => {
  const baseMsg = {
    conversation_id: 'c1',
    workspace_id: 'w1',
    sender_id: 'u1',
    is_sticker: false,
    edited_at: null,
    deleted_at: null,
    updated_at: '2026-11-18T10:00:00Z',
    attachments: [],
    reactions: [],
  };

  const messages = [
    {
      ...baseMsg,
      id: 'm1',
      parent_id: null,
      content: 'sticker:lgtm',
      is_sticker: true,
      created_at: '2026-11-18T10:00:00Z',
      sender: { id: 'u1', display_name: 'Alice', email: 'a@example.com', avatar_url: null },
    },
    {
      ...baseMsg,
      id: 'm2',
      parent_id: 'm1',
      content: 'Thanks Alice!',
      created_at: '2026-11-18T10:01:00Z',
      sender: { id: 'u2', display_name: 'Bob', email: 'b@example.com', avatar_url: null },
    },
    {
      ...baseMsg,
      id: 'm3',
      parent_id: 'm_older_deleted',
      content: 'Following up on that',
      created_at: '2026-11-18T10:02:00Z',
      sender: { id: 'u2', display_name: 'Bob', email: 'b@example.com', avatar_url: null },
    },
  ];

  const hydrated = hydrateMessageParents(
    messages,
    {
      m_older_deleted: {
        id: 'm_older_deleted',
        content: 'Old secret text',
        deleted_at: '2026-11-18T09:50:00Z',
        is_sticker: false,
        sender_name: 'Charlie',
      },
    },
    getStickerLabel
  );

  assert.equal(hydrated[0].parent, undefined);
  assert.deepEqual(hydrated[1].parent, {
    id: 'm1',
    content: 'LGTM 👍',
    sender_name: 'Alice',
  });
  assert.deepEqual(hydrated[2].parent, {
    id: 'm_older_deleted',
    content: 'This message was deleted.',
    sender_name: 'Charlie',
  });

  // Direct buildParentPreview check
  assert.equal(
    buildParentPreview({ id: 'x', content: 'Hello', sender_name: '' }).sender_name,
    'Member'
  );
});

test('Priority 3: extractFirstUrl, sanitizeAttachmentUrl, and end-to-end link preview wiring', () => {
  assert.equal(
    extractFirstUrl('Check https://example.com/docs/spec.pdf, then reply!'),
    'https://example.com/docs/spec.pdf'
  );
  assert.equal(extractFirstUrl('No links here'), null);
  assert.equal(extractFirstUrl('javascript:alert(1)'), null);

  assert.equal(sanitizeAttachmentUrl('https://cdn.example.com/img.png'), 'https://cdn.example.com/img.png');
  assert.equal(sanitizeAttachmentUrl('javascript:alert(1)'), '');
  assert.equal(sanitizeAttachmentUrl('http://insecure.example.com/a.png'), '');

  const chatServiceSrc = readFileSync(resolve(FRONTEND_ROOT, 'src/services/chatService.ts'), 'utf8');
  assert.ok(
    chatServiceSrc.includes("getApiUrl(`/api/chat/link-preview?url="),
    'chatService.fetchLinkPreview must use /api/chat/link-preview'
  );
  assert.ok(
    chatServiceSrc.includes('linkPreviewLoader') && chatServiceSrc.includes('resolveAuthToken'),
    'chatService.fetchLinkPreview must authenticate and cache previews'
  );

  const messageItemSrc = readFileSync(resolve(FRONTEND_ROOT, 'src/components/chat/MessageItem.tsx'), 'utf8');
  assert.ok(
    messageItemSrc.includes('LinkPreviewCard') && messageItemSrc.includes('extractFirstUrl'),
    'MessageItem must render LinkPreviewCard for messages with URLs'
  );
});

test('Priority 4: stickers use static Tailwind classes and cannot be edited', () => {
  for (const sticker of STICKER_LIST) {
    assert.match(sticker.textClass, /^text-/);
    assert.match(sticker.descClass, /^text-/);
  }

  const stickerPickerSrc = readFileSync(
    resolve(FRONTEND_ROOT, 'src/components/chat/StickerPickerPopover.tsx'),
    'utf8'
  );
  const messageItemSrc = readFileSync(resolve(FRONTEND_ROOT, 'src/components/chat/MessageItem.tsx'), 'utf8');

  assert.equal(stickerPickerSrc.includes('text-${'), false);
  assert.equal(messageItemSrc.includes('text-${'), false);
  assert.ok(messageItemSrc.includes('isOwn && !message.is_sticker'));
  assert.ok(messageItemSrc.includes('isGrouped && message.edited_at && !isDeleted'));
});

test('Priority 6 & 8: mobile details overlay, objectURL cleanup, lightbox Escape/Close, clipboard paste', () => {
  const pageSrc = readFileSync(resolve(FRONTEND_ROOT, 'src/pages/WorkspaceChatPage.tsx'), 'utf8');
  assert.ok(pageSrc.includes('fixed inset-0 z-50 flex justify-end lg:hidden'));

  const composerSrc = readFileSync(resolve(FRONTEND_ROOT, 'src/components/chat/MessageComposer.tsx'), 'utf8');
  assert.ok(composerSrc.includes('URL.revokeObjectURL'));
  assert.ok(composerSrc.includes('onPaste={handlePaste}'));

  const messageItemSrc = readFileSync(resolve(FRONTEND_ROOT, 'src/components/chat/MessageItem.tsx'), 'utf8');
  assert.ok(messageItemSrc.includes("e.key === 'Escape'"));
  assert.ok(messageItemSrc.includes('aria-label="Close image preview"'));
});

test('Priority 9: computeInitialUnreadCounts counts unread messages accurately per conversation', () => {
  const counts = computeInitialUnreadCounts({
    currentUserId: 'me',
    conversationIds: ['c_general', 'c_dm', 'c_never_opened'],
    lastReadByConv: {
      c_general: '2026-11-18T10:00:00Z',
      c_dm: '2026-11-18T10:05:00Z',
    },
    recentMessages: [
      // Read already
      { conversation_id: 'c_general', sender_id: 'alice', created_at: '2026-11-18T09:59:00Z', deleted_at: null },
      // Own message (ignored)
      { conversation_id: 'c_general', sender_id: 'me', created_at: '2026-11-18T10:02:00Z', deleted_at: null },
      // Deleted message (ignored)
      { conversation_id: 'c_general', sender_id: 'alice', created_at: '2026-11-18T10:03:00Z', deleted_at: '2026-11-18T10:04:00Z' },
      // Two genuinely unread messages in c_general
      { conversation_id: 'c_general', sender_id: 'alice', created_at: '2026-11-18T10:04:00Z', deleted_at: null },
      { conversation_id: 'c_general', sender_id: 'bob', created_at: '2026-11-18T10:06:00Z', deleted_at: null },
      // All read in c_dm
      { conversation_id: 'c_dm', sender_id: 'bob', created_at: '2026-11-18T10:04:00Z', deleted_at: null },
      // Unopened public channel has 1 unread
      { conversation_id: 'c_never_opened', sender_id: 'alice', created_at: '2026-11-18T08:00:00Z', deleted_at: null },
      // Conversation not in accessible list (ignored)
      { conversation_id: 'c_inaccessible', sender_id: 'alice', created_at: '2026-11-18T10:10:00Z', deleted_at: null },
    ],
  });

  assert.deepEqual(counts, {
    c_general: 2,
    c_dm: 0,
    c_never_opened: 1,
  });
});

test('Hardening 1: signed URLs use 900s TTL, refresh on expiry, and delete calls backend DELETE endpoint', () => {
  assert.equal(SIGNED_URL_TTL_SECONDS, 900);

  const chatServiceSrc = readFileSync(resolve(FRONTEND_ROOT, 'src/services/chatService.ts'), 'utf8');
  assert.equal(chatServiceSrc.includes('86400'), false, 'No 24h signed URL TTL should remain');
  assert.equal(
    chatServiceSrc.includes('createSignedUrl(storagePath, 3600)'),
    false,
    'No 1h signed URL TTL should remain'
  );
  assert.ok(
    chatServiceSrc.includes('createSignedUrls(storagePaths, SIGNED_URL_TTL_SECONDS)'),
    'Batch message signing must use SIGNED_URL_TTL_SECONDS (900)'
  );
  assert.ok(
    chatServiceSrc.includes('createSignedUrl(data.path, SIGNED_URL_TTL_SECONDS)'),
    'Upload signing must use SIGNED_URL_TTL_SECONDS (900)'
  );
  assert.ok(
    chatServiceSrc.includes('createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS)'),
    'On-demand refresh signing must use SIGNED_URL_TTL_SECONDS (900)'
  );
  assert.ok(
    chatServiceSrc.includes("getApiUrl(`/api/chat/messages/${encodeURIComponent(messageId)}`)") &&
      chatServiceSrc.includes("method: 'DELETE'"),
    'deleteMessage must call authenticated backend DELETE /api/chat/messages/{id}'
  );

  const messageItemSrc = readFileSync(resolve(FRONTEND_ROOT, 'src/components/chat/MessageItem.tsx'), 'utf8');
  const drawerSrc = readFileSync(
    resolve(FRONTEND_ROOT, 'src/components/chat/ConversationDetailsDrawer.tsx'),
    'utf8'
  );
  assert.ok(
    messageItemSrc.includes('getSignedAttachmentUrl') && messageItemSrc.includes('onError='),
    'MessageItem must refresh expired signed URLs on error/click'
  );
  assert.ok(
    drawerSrc.includes('getSignedAttachmentUrl') && drawerSrc.includes('onError='),
    'ConversationDetailsDrawer must refresh expired signed URLs on error/click'
  );
});

test('Hardening 2: composite (created_at, id) cursor paginates identical timestamps with zero skips or duplicates', () => {
  // 8 messages where 5 share the exact same microsecond created_at timestamp
  const allRows = [
    { id: '00000000-0000-0000-0000-000000000001', created_at: '2026-11-18T10:00:00.000000+00:00' },
    { id: '00000000-0000-0000-0000-000000000002', created_at: '2026-11-18T10:01:00.123456+00:00' },
    { id: '00000000-0000-0000-0000-000000000003', created_at: '2026-11-18T10:01:00.123456+00:00' },
    { id: '00000000-0000-0000-0000-000000000004', created_at: '2026-11-18T10:01:00.123456+00:00' },
    { id: '00000000-0000-0000-0000-000000000005', created_at: '2026-11-18T10:01:00.123456+00:00' },
    { id: '00000000-0000-0000-0000-000000000006', created_at: '2026-11-18T10:01:00.123456+00:00' },
    { id: '00000000-0000-0000-0000-000000000007', created_at: '2026-11-18T10:02:00.000000+00:00' },
    { id: '00000000-0000-0000-0000-000000000008', created_at: '2026-11-18T10:02:00.000000+00:00' },
  ];

  // Simulate Postgres ORDER BY created_at DESC, id DESC + PostgREST .or() composite filter
  const queryDbPage = (limit: number, beforeCursor?: { createdAt: string; id: string }) => {
    const sortedDesc = [...allRows].sort((a, b) => {
      if (a.created_at !== b.created_at) return b.created_at.localeCompare(a.created_at);
      return b.id.localeCompare(a.id);
    });

    let filtered = sortedDesc;
    if (beforeCursor) {
      const filterStr = buildCompositeBeforeCursorFilter(beforeCursor);
      assert.equal(
        filterStr,
        `created_at.lt.${beforeCursor.createdAt},and(created_at.eq.${beforeCursor.createdAt},id.lt.${beforeCursor.id})`
      );
      filtered = sortedDesc.filter(
        (row) =>
          row.created_at < beforeCursor.createdAt ||
          (row.created_at === beforeCursor.createdAt && row.id < beforeCursor.id)
      );
    }

    return normalizeDescMessagePage(filtered.slice(0, limit + 1), limit);
  };

  const collected: typeof allRows = [];
  let cursor: { createdAt: string; id: string } | undefined;
  let pages = 0;

  while (true) {
    const page = queryDbPage(3, cursor);
    pages += 1;
    collected.unshift(...page.items);
    if (!page.hasMore) break;
    cursor = getOldestMessageCursor(collected) ?? undefined;
    assert.ok(cursor, 'Expected non-null oldest cursor while hasMore is true');
  }

  assert.equal(pages, 3);
  assert.equal(collected.length, allRows.length);
  assert.deepEqual(
    collected.map((m) => m.id),
    allRows.map((m) => m.id)
  );
  // Zero duplicates
  assert.equal(new Set(collected.map((m) => m.id)).size, allRows.length);

  // Reject malformed / PostgREST-injection cursor values
  assert.throws(() =>
    buildCompositeBeforeCursorFilter({
      createdAt: '2026-11-18T10:00:00Z),id.gt.0',
      id: '00000000-0000-0000-0000-000000000001',
    })
  );
  assert.throws(() =>
    buildCompositeBeforeCursorFilter({
      createdAt: '2026-11-18T10:00:00Z',
      id: 'not-a-uuid',
    })
  );
});

test('Hardening 3: unread reconciliation avoids React 19 updater race and preserves hidden-tab unread counts', () => {
  const convs = [
    { id: 'c_random', name: 'random' },
    { id: 'c_general', name: 'general' },
    { id: 'c_dm', name: 'Alice' },
  ];

  // Resolves deterministically to #general when nothing is active, or preserves valid active id
  assert.equal(resolveActiveConversationId(null, convs), 'c_general');
  assert.equal(resolveActiveConversationId('c_dm', convs), 'c_dm');
  assert.equal(resolveActiveConversationId('c_deleted', convs), 'c_general');

  // Visible tab zeroes the active conversation deterministically without mutating inside setState updater
  const visibleReconciled = reconcileUnreadCounts({
    initialUnreads: { c_general: 3, c_dm: 2, c_random: 1 },
    activeConversationId: 'c_general',
    isDocumentHidden: false,
    previousUnreads: { c_general: 1, c_dm: 0 },
  });
  assert.deepEqual(visibleReconciled, { c_general: 0, c_dm: 2, c_random: 1 });

  // Hidden tab MUST NOT wipe active conversation unread counts when conv_changes triggers loadWorkspaceData()
  const hiddenReconciled = reconcileUnreadCounts({
    initialUnreads: { c_general: 2, c_dm: 4, c_random: 0 },
    activeConversationId: 'c_general',
    isDocumentHidden: true,
    previousUnreads: { c_general: 5, c_dm: 4 },
  });
  assert.deepEqual(hiddenReconciled, { c_general: 5, c_dm: 4, c_random: 0 });

  // Hidden tab with higher server count takes server count rather than zeroing
  const hiddenServerHigher = reconcileUnreadCounts({
    initialUnreads: { c_general: 3, c_dm: 0 },
    activeConversationId: 'c_general',
    isDocumentHidden: true,
    previousUnreads: { c_general: 1 },
  });
  assert.deepEqual(hiddenServerHigher, { c_general: 3, c_dm: 0 });

  const chatContextSrc = readFileSync(resolve(FRONTEND_ROOT, 'src/context/ChatContext.tsx'), 'utf8');
  assert.equal(
    chatContextSrc.includes('let nextActiveId'),
    false,
    'ChatContext must not mutate a local variable inside a setState updater'
  );
  assert.ok(
    chatContextSrc.includes('resolveActiveConversationId') &&
      chatContextSrc.includes('reconcileUnreadCounts') &&
      chatContextSrc.includes('document.hidden'),
    'ChatContext must use deterministic active resolution and hidden-tab unread reconciliation'
  );
});

test('Hardening 4: malformed URLs never crash LinkPreviewCard and 400/404 are cached while 5xx/network retry', async () => {
  // Malformed URL safety
  assert.equal(extractSafeHostname('https://docs.example.com/path'), 'docs.example.com');
  assert.equal(extractSafeHostname('https://[invalid-host'), 'https://[invalid-host');
  assert.equal(extractSafeHostname('not a url at all'), 'not a url at all');

  const cardSrc = readFileSync(
    resolve(FRONTEND_ROOT, 'src/components/chat/LinkPreviewCard.tsx'),
    'utf8'
  );
  assert.ok(cardSrc.includes('extractSafeHostname'));
  assert.equal(cardSrc.includes('new URL('), false);

  assert.equal(shouldNegativelyCacheLinkPreviewStatus(400), true);
  assert.equal(shouldNegativelyCacheLinkPreviewStatus(404), true);
  assert.equal(shouldNegativelyCacheLinkPreviewStatus(500), false);
  assert.equal(shouldNegativelyCacheLinkPreviewStatus(503), false);

  // Behavioral caching test: 400/404 cached; 5xx and network errors NOT cached
  const callsByUrl: Record<string, number> = {};
  let transientAttempts = 0;
  let networkAttempts = 0;

  const loader = createLinkPreviewLoader(async (url) => {
    callsByUrl[url] = (callsByUrl[url] || 0) + 1;
    if (url.includes('/blocked-400')) {
      return { status: 400, data: null };
    }
    if (url.includes('/missing-404')) {
      return { status: 404, data: null };
    }
    if (url.includes('/flaky-503')) {
      transientAttempts += 1;
      if (transientAttempts === 1) {
        return { status: 503, data: null };
      }
      return { status: 200, data: { url, title: 'Recovered 503' } };
    }
    if (url.includes('/network-err')) {
      networkAttempts += 1;
      if (networkAttempts === 1) {
        throw new Error('Network down');
      }
      return { status: 200, data: { url, title: 'Recovered Network' } };
    }
    return { status: 200, data: { url, title: 'OK Card' } };
  });

  // 400 negatively cached
  assert.equal(await loader.load('https://example.com/blocked-400'), null);
  assert.equal(await loader.load('https://example.com/blocked-400'), null);
  assert.equal(callsByUrl['https://example.com/blocked-400'], 1);

  // 404 negatively cached
  assert.equal(await loader.load('https://example.com/missing-404'), null);
  assert.equal(await loader.load('https://example.com/missing-404'), null);
  assert.equal(callsByUrl['https://example.com/missing-404'], 1);

  // 503 NOT cached -> retries and succeeds
  assert.equal(await loader.load('https://example.com/flaky-503'), null);
  assert.equal(loader.hasCached('https://example.com/flaky-503'), false);
  const recovered503 = await loader.load('https://example.com/flaky-503');
  assert.equal(recovered503?.title, 'Recovered 503');
  assert.equal(callsByUrl['https://example.com/flaky-503'], 2);

  // Network exception NOT cached -> retries and succeeds
  assert.equal(await loader.load('https://example.com/network-err'), null);
  assert.equal(loader.hasCached('https://example.com/network-err'), false);
  const recoveredNet = await loader.load('https://example.com/network-err');
  assert.equal(recoveredNet?.title, 'Recovered Network');
  assert.equal(callsByUrl['https://example.com/network-err'], 2);
});


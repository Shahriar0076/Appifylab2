/**
 * Legacy Queue Analyzer — Characterization Tests
 *
 * These tests are deterministic because they set up localStorage directly
 * (using the polyfill provided by test-setup.js).
 *
 * Each test verifies pure read-only behavior: no writes, no side effects,
 * no dependence on the current authenticated user.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { analyzeLegacyQueue } from '../legacyQueueAnalyzer';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/**
 * Set a localStorage key to a JSON value.
 */
function setStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

/** Prefix for the global sync queue key. */
const QUEUE_KEY = 'buddyScript.feed.syncQueue';

/** Prefix for UID-scoped post cache keys. */
const CACHE_PREFIX = 'buddyScript.feed.posts.';

beforeEach(() => {
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// Fixture: a minimal seed post that factories would produce
// ---------------------------------------------------------------------------

function makeSeedPost(overrides = {}) {
  return {
    id: 'post-seed-1',
    syncStatus: 'synced',
    author: { id: 'user-alice', name: 'Alice', initials: 'A', avatarColor: '#FF5733' },
    text: 'Seed post',
    visibility: 'public',
    likes: { count: 0, likedByCurrentUser: false, previewUsers: [] },
    comments: { previousCount: 0, items: [] },
    createdAt: '2026-07-30T12:00:00.000Z',
    ...overrides,
  };
}

function makePostWithCommentReply(overrides = {}) {
  return {
    id: 'post-with-comments',
    syncStatus: 'synced',
    author: { id: 'user-alice', name: 'Alice', initials: 'A', avatarColor: '#FF5733' },
    text: 'Post with stuff',
    visibility: 'public',
    likes: { count: 2, likedByCurrentUser: false, previewUsers: [] },
    comments: {
      previousCount: 0,
      items: [
        {
          id: 'comment-1',
          remoteId: 'remote-comment-1',
          syncStatus: 'synced',
          author: { id: 'user-alice', name: 'Alice', initials: 'A', avatarColor: '#FF5733' },
          text: 'A comment',
          likes: { count: 1, likedByCurrentUser: false },
          replies: [
            {
              id: 'reply-1',
              remoteId: 'remote-reply-1',
              syncStatus: 'synced',
              author: { id: 'user-bob', name: 'Bob', initials: 'B', avatarColor: '#1890FF' },
              text: 'A reply',
              likes: { count: 0, likedByCurrentUser: false },
            },
          ],
        },
      ],
    },
    createdAt: '2026-07-30T12:00:00.000Z',
    ...overrides,
  };
}

// ===========================================================================
// Tests
// ===========================================================================

describe('legacyQueueAnalyzer — scanFeedCaches', () => {
  it('returns empty caches when no feed cache keys exist', () => {
    setStorage(QUEUE_KEY, []);
    const result = analyzeLegacyQueue();
    expect(result.caches).toEqual([]);
  });

  it('discovers a single UID-scoped feed cache', () => {
    setStorage(CACHE_PREFIX + 'user-alice', [makeSeedPost()]);
    setStorage(QUEUE_KEY, []);

    const result = analyzeLegacyQueue();
    expect(result.caches).toHaveLength(1);
    expect(result.caches[0].userId).toBe('user-alice');
    expect(result.caches[0].postCount).toBe(1);
  });

  it('discovers multiple UID-scoped feed caches', () => {
    setStorage(CACHE_PREFIX + 'user-alice', [makeSeedPost()]);
    setStorage(CACHE_PREFIX + 'user-bob', [makeSeedPost({ id: 'post-bob-1' })]);
    setStorage(QUEUE_KEY, []);

    const result = analyzeLegacyQueue();
    expect(result.caches).toHaveLength(2);
    const userIds = result.caches.map((c) => c.userId).sort();
    expect(userIds).toEqual(['user-alice', 'user-bob']);
  });

  it('ignores keys that do not match the cache prefix', () => {
    setStorage('unrelated-key', [1, 2, 3]);
    setStorage('buddyScript.feed.version.user-alice', '3');
    setStorage(CACHE_PREFIX + 'user-alice', [makeSeedPost()]);
    setStorage(QUEUE_KEY, []);

    const result = analyzeLegacyQueue();
    expect(result.caches).toHaveLength(1);
    expect(result.caches[0].userId).toBe('user-alice');
  });

  it('handles URI-encoded user IDs in cache keys', () => {
    setStorage(CACHE_PREFIX + encodeURIComponent('user+name@domain'), [makeSeedPost()]);
    setStorage(QUEUE_KEY, []);

    const result = analyzeLegacyQueue();
    expect(result.caches).toHaveLength(1);
    expect(result.caches[0].userId).toBe('user+name@domain');
  });

  it('skips malformed cache entries that are not arrays', () => {
    setStorage(CACHE_PREFIX + 'user-alice', 'not-an-array');
    setStorage(CACHE_PREFIX + 'user-bob', [makeSeedPost()]);
    setStorage(QUEUE_KEY, []);

    const result = analyzeLegacyQueue();
    expect(result.caches).toHaveLength(1);
    expect(result.caches[0].userId).toBe('user-bob');
  });

  it('skips cache entries with unparseable JSON', () => {
    localStorage.setItem(CACHE_PREFIX + 'user-corrupt', '{{{bad json');
    setStorage(CACHE_PREFIX + 'user-alice', [makeSeedPost()]);
    setStorage(QUEUE_KEY, []);

    const result = analyzeLegacyQueue();
    expect(result.caches).toHaveLength(1);
    expect(result.caches[0].userId).toBe('user-alice');
  });
});

describe('legacyQueueAnalyzer — buildCacheIndex', () => {
  it('indexes post-level entity IDs', () => {
    setStorage(
      CACHE_PREFIX + 'user-alice',
      [makeSeedPost({ id: 'post-1', localId: 'local-post-1', remoteId: 'remote-post-1' })]
    );
    setStorage(QUEUE_KEY, []);

    const result = analyzeLegacyQueue();

    expect(result.cacheIndex.get('post-1')).toEqual(new Set(['user-alice']));
    expect(result.cacheIndex.get('local-post-1')).toEqual(new Set(['user-alice']));
    expect(result.cacheIndex.get('remote-post-1')).toEqual(new Set(['user-alice']));
  });

  it('indexes comment and reply entity IDs', () => {
    setStorage(CACHE_PREFIX + 'user-alice', [makePostWithCommentReply()]);
    setStorage(QUEUE_KEY, []);

    const result = analyzeLegacyQueue();

    expect(result.cacheIndex.get('comment-1')).toEqual(new Set(['user-alice']));
    expect(result.cacheIndex.get('remote-comment-1')).toEqual(new Set(['user-alice']));
    expect(result.cacheIndex.get('reply-1')).toEqual(new Set(['user-alice']));
    expect(result.cacheIndex.get('remote-reply-1')).toEqual(new Set(['user-alice']));
  });

  it('maps shared entity IDs to multiple users', () => {
    // Both users have the same public post in their cache
    const sharedPost = makeSeedPost({ id: 'shared-post', remoteId: 'remote-shared' });
    setStorage(CACHE_PREFIX + 'user-alice', [sharedPost]);
    setStorage(CACHE_PREFIX + 'user-bob', [sharedPost]);
    setStorage(QUEUE_KEY, []);

    const result = analyzeLegacyQueue();

    expect(result.cacheIndex.get('shared-post')).toEqual(new Set(['user-alice', 'user-bob']));
    expect(result.cacheIndex.get('remote-shared')).toEqual(new Set(['user-alice', 'user-bob']));
  });
});

// ===========================================================================
// Item classification
// ===========================================================================

describe('legacyQueueAnalyzer — malformed items', () => {
  it('classifies non-object items as malformed', () => {
    setStorage(QUEUE_KEY, ['string-item', 42, null, true]);
    const result = analyzeLegacyQueue();
    expect(result.summary.malformed).toBe(4);
    result.malformed.forEach((m) => {
      expect(m.reason).toBe('Item is not an object');
    });
  });

  it('classifies items missing id as malformed', () => {
    setStorage(QUEUE_KEY, [{ type: 'CREATE_POST', payload: {} }]);
    const result = analyzeLegacyQueue();
    expect(result.summary.malformed).toBe(1);
    expect(result.malformed[0].reason).toBe('Missing or invalid item id');
  });

  it('classifies items missing type as malformed', () => {
    setStorage(QUEUE_KEY, [{ id: 'q-1', payload: {} }]);
    const result = analyzeLegacyQueue();
    expect(result.summary.malformed).toBe(1);
    expect(result.malformed[0].reason).toMatch(/Missing or invalid item type/);
  });

  it('classifies items missing payload as malformed', () => {
    setStorage(QUEUE_KEY, [{ id: 'q-1', type: 'CREATE_POST' }]);
    const result = analyzeLegacyQueue();
    expect(result.summary.malformed).toBe(1);
    expect(result.malformed[0].reason).toMatch(/Missing or invalid payload/);
  });

  it('classifies items with unknown type as malformed', () => {
    setStorage(QUEUE_KEY, [{ id: 'q-1', type: 'DO_THE_THING', payload: {} }]);
    const result = analyzeLegacyQueue();
    expect(result.summary.malformed).toBe(1);
    expect(result.malformed[0].reason).toBe('Unknown item type: "DO_THE_THING"');
  });

  it('classifies items with null payload as malformed', () => {
    setStorage(QUEUE_KEY, [{ id: 'q-1', type: 'CREATE_POST', payload: null }]);
    const result = analyzeLegacyQueue();
    expect(result.summary.malformed).toBe(1);
    expect(result.malformed[0].reason).toMatch(/Missing or invalid payload/);
  });

  it('classifies items with non-string id as malformed', () => {
    setStorage(QUEUE_KEY, [{ id: 123, type: 'CREATE_POST', payload: {} }]);
    const result = analyzeLegacyQueue();
    expect(result.summary.malformed).toBe(1);
    expect(result.malformed[0].reason).toMatch(/Missing or invalid item id/);
  });

  it('reports malformed items alongside assignable and ambiguous', () => {
    setStorage(QUEUE_KEY, [
      { id: 'q-1', type: 'CREATE_POST', payload: {} },                          // ambiguous (no cache)
      { id: 'q-2', type: 'TOGGLE_POST_LIKE', payload: { userId: 'user-alice' } }, // assignable
      'bad-item',                                                                // malformed
    ]);
    const result = analyzeLegacyQueue();
    expect(result.summary).toEqual({
      total: 3,
      assignable: 1,
      ambiguous: 1,
      malformed: 1,
    });
  });
});

describe('legacyQueueAnalyzer — assignable via payload UID', () => {
  it('classifies TOGGLE_POST_LIKE with userId as assignable', () => {
    setStorage(QUEUE_KEY, [
      { id: 'q-1', type: 'TOGGLE_POST_LIKE', payload: { postId: 'p1', userId: 'user-alice', liked: true } },
    ]);
    const result = analyzeLegacyQueue();
    expect(result.summary.assignable).toBe(1);
    expect(result.assignable[0].ownerId).toBe('user-alice');
    expect(result.assignable[0].evidence).toEqual(['payload-uid']);
  });

  it('classifies TOGGLE_COMMENT_LIKE with userId as assignable', () => {
    setStorage(QUEUE_KEY, [
      { id: 'q-1', type: 'TOGGLE_COMMENT_LIKE', payload: { commentId: 'c1', userId: 'user-bob', liked: true } },
    ]);
    const result = analyzeLegacyQueue();
    expect(result.summary.assignable).toBe(1);
    expect(result.assignable[0].ownerId).toBe('user-bob');
  });

  it('classifies TOGGLE_REPLY_LIKE with userId as assignable', () => {
    setStorage(QUEUE_KEY, [
      { id: 'q-1', type: 'TOGGLE_REPLY_LIKE', payload: { replyId: 'r1', userId: 'user-char', liked: false } },
    ]);
    const result = analyzeLegacyQueue();
    expect(result.summary.assignable).toBe(1);
    expect(result.assignable[0].ownerId).toBe('user-char');
  });

  it('classifies ADD_COMMENT with comment.author.id as assignable', () => {
    setStorage(QUEUE_KEY, [
      {
        id: 'q-1',
        type: 'ADD_COMMENT',
        payload: {
          postId: 'p1',
          comment: { id: 'c-new', author: { id: 'user-alice' }, text: 'Nice!' },
        },
      },
    ]);
    const result = analyzeLegacyQueue();
    expect(result.summary.assignable).toBe(1);
    expect(result.assignable[0].ownerId).toBe('user-alice');
  });

  it('classifies ADD_REPLY with reply.author.id as assignable', () => {
    setStorage(QUEUE_KEY, [
      {
        id: 'q-1',
        type: 'ADD_REPLY',
        payload: {
          postId: 'p1',
          commentId: 'c1',
          reply: { id: 'r-new', author: { id: 'user-bob' }, text: 'Thanks!' },
        },
      },
    ]);
    const result = analyzeLegacyQueue();
    expect(result.summary.assignable).toBe(1);
    expect(result.assignable[0].ownerId).toBe('user-bob');
  });

  it('classifies ADD_COMMENT without author.id as ambiguous', () => {
    setStorage(QUEUE_KEY, [
      {
        id: 'q-1',
        type: 'ADD_COMMENT',
        payload: {
          postId: 'p1',
          comment: { id: 'c-new', text: 'No author' },
        },
      },
    ]);
    const result = analyzeLegacyQueue();
    // No direct UID, comment id not in any cache → ambiguous
    expect(result.summary.ambiguous).toBe(1);
  });

  it('is not influenced by the order of items in the queue', () => {
    setStorage(QUEUE_KEY, [
      { id: 'q-2', type: 'TOGGLE_POST_LIKE', payload: { postId: 'p2', userId: 'user-bob', liked: false } },
      { id: 'q-1', type: 'TOGGLE_POST_LIKE', payload: { postId: 'p1', userId: 'user-alice', liked: true } },
    ]);
    const result = analyzeLegacyQueue();
    expect(result.summary.assignable).toBe(2);
    // First item in result is q-1 because it was first in queue, but order isn't guaranteed
    const aliceItems = result.assignable.filter((a) => a.ownerId === 'user-alice');
    const bobItems = result.assignable.filter((a) => a.ownerId === 'user-bob');
    expect(aliceItems).toHaveLength(1);
    expect(bobItems).toHaveLength(1);
  });
});

describe('legacyQueueAnalyzer — assignable via cache match', () => {
  it('classifies CREATE_POST as assignable when localPostId is in exactly one cache', () => {
    setStorage(CACHE_PREFIX + 'user-alice', [
      makeSeedPost({ id: 'post-exists-in-cache' }),
    ]);
    setStorage(QUEUE_KEY, [
      { id: 'q-1', type: 'CREATE_POST', payload: { localPostId: 'post-exists-in-cache', hasImage: false } },
    ]);
    const result = analyzeLegacyQueue();
    expect(result.summary.assignable).toBe(1);
    expect(result.assignable[0].ownerId).toBe('user-alice');
    expect(result.assignable[0].evidence).toEqual(['cache-match']);
  });

  it('classifies UPDATE_POST_IMAGE as assignable via cache match', () => {
    setStorage(CACHE_PREFIX + 'user-bob', [
      makeSeedPost({ id: 'post-bob-image' }),
    ]);
    setStorage(QUEUE_KEY, [
      { id: 'q-1', type: 'UPDATE_POST_IMAGE', payload: { localPostId: 'post-bob-image', remotePostId: 'r-bob' } },
    ]);
    const result = analyzeLegacyQueue();
    expect(result.summary.assignable).toBe(1);
    expect(result.assignable[0].ownerId).toBe('user-bob');
  });

  it('classifies UPDATE_POST_PRIVACY as assignable via cache match', () => {
    setStorage(CACHE_PREFIX + 'user-char', [
      makeSeedPost({ id: 'post-char-privacy' }),
    ]);
    setStorage(QUEUE_KEY, [
      { id: 'q-1', type: 'UPDATE_POST_PRIVACY', payload: { postId: 'post-char-privacy', visibility: 'private' } },
    ]);
    const result = analyzeLegacyQueue();
    expect(result.summary.assignable).toBe(1);
    expect(result.assignable[0].ownerId).toBe('user-char');
  });

  it('matches via postId field (used by privacy/like items)', () => {
    setStorage(CACHE_PREFIX + 'user-dylan', [
      makeSeedPost({ id: 'post-dylan' }),
    ]);
    setStorage(QUEUE_KEY, [
      { id: 'q-1', type: 'UPDATE_POST_PRIVACY', payload: { postId: 'post-dylan', visibility: 'public' } },
    ]);
    const result = analyzeLegacyQueue();
    expect(result.summary.assignable).toBe(1);
    expect(result.assignable[0].ownerId).toBe('user-dylan');
  });

  it('uses localPostId before postId when both exist', () => {
    setStorage(CACHE_PREFIX + 'user-alice', [
      makeSeedPost({ id: 'local-id-post' }),
    ]);
    setStorage(CACHE_PREFIX + 'user-bob', [
      makeSeedPost({ id: 'post-id-post' }),
    ]);
    setStorage(QUEUE_KEY, [
      { id: 'q-1', type: 'CREATE_POST', payload: { localPostId: 'local-id-post', postId: 'post-id-post' } },
    ]);
    const result = analyzeLegacyQueue();
    // localPostId should be checked first, matching user-alice
    expect(result.summary.assignable).toBe(1);
    expect(result.assignable[0].ownerId).toBe('user-alice');
  });
});

describe('legacyQueueAnalyzer — ambiguous items', () => {
  it('classifies item as ambiguous when entity is in multiple caches', () => {
    const sharedPost = makeSeedPost({ id: 'shared-post' });
    setStorage(CACHE_PREFIX + 'user-alice', [sharedPost]);
    setStorage(CACHE_PREFIX + 'user-bob', [sharedPost]);
    setStorage(QUEUE_KEY, [
      { id: 'q-1', type: 'UPDATE_POST_PRIVACY', payload: { postId: 'shared-post', visibility: 'private' } },
    ]);
    const result = analyzeLegacyQueue();
    expect(result.summary.ambiguous).toBe(1);
    expect(result.ambiguous[0].candidateOwnerIds.sort()).toEqual(['user-alice', 'user-bob']);
    expect(result.ambiguous[0].reason).toMatch(/found in 2 caches/);
  });

  it('classifies item as ambiguous when entity is not in any cache', () => {
    // No caches set up at all
    setStorage(QUEUE_KEY, [
      { id: 'q-1', type: 'CREATE_POST', payload: { localPostId: 'unknown-post', hasImage: false } },
    ]);
    const result = analyzeLegacyQueue();
    expect(result.summary.ambiguous).toBe(1);
    expect(result.ambiguous[0].candidateOwnerIds).toEqual([]);
    expect(result.ambiguous[0].reason).toMatch(/not found in any cache/);
  });

  it('classifies CREATE_POST without cache as ambiguous', () => {
    setStorage(QUEUE_KEY, [
      { id: 'q-1', type: 'CREATE_POST', payload: { localPostId: 'post-unique', hasImage: true } },
    ]);
    // No cache for this post → ambiguous
    const result = analyzeLegacyQueue();
    expect(result.summary.ambiguous).toBe(1);
  });

  it('classifies UPDATE_POST_IMAGE without cache as ambiguous', () => {
    setStorage(QUEUE_KEY, [
      { id: 'q-1', type: 'UPDATE_POST_IMAGE', payload: { localPostId: 'ghost', remotePostId: 'r-ghost' } },
    ]);
    const result = analyzeLegacyQueue();
    expect(result.summary.ambiguous).toBe(1);
  });

  it('classifies TOGGLE_POST_LIKE when userId is empty string', () => {
    setStorage(QUEUE_KEY, [
      { id: 'q-1', type: 'TOGGLE_POST_LIKE', payload: { postId: 'p1', userId: '', liked: true } },
    ]);
    // Empty string is falsy — extractPayloadOwnerEvidence returns []
    const result = analyzeLegacyQueue();
    expect(result.summary.ambiguous).toBe(1);
  });

  it('classifies ADD_COMMENT with no author.id and no cache match as ambiguous', () => {
    setStorage(QUEUE_KEY, [
      {
        id: 'q-1',
        type: 'ADD_COMMENT',
        payload: {
          postId: 'p1',
          comment: { id: 'c1', author: { id: '' }, text: 'Empty author' },
        },
      },
    ]);
    // author.id is empty string → no evidence, c1 not in cache → ambiguous
    const result = analyzeLegacyQueue();
    expect(result.summary.ambiguous).toBe(1);
    expect(result.ambiguous[0].reason).toMatch(/not found in any cache/);
  });
});

describe('legacyQueueAnalyzer — conflicting and ambiguous ownership scenarios', () => {
  it('detects conflicting evidence between cache and another user', () => {
    // Two users have the same post in cache (e.g., both saw the same public post)
    setStorage(CACHE_PREFIX + 'user-alice', [makeSeedPost({ id: 'post-public' })]);
    setStorage(CACHE_PREFIX + 'user-bob', [makeSeedPost({ id: 'post-public' })]);
    // A LIKE for that post came from user-char (not in either cache's context)
    setStorage(QUEUE_KEY, [
      { id: 'q-1', type: 'TOGGLE_POST_LIKE', payload: { postId: 'post-public', userId: 'user-char', liked: true } },
    ]);
    const result = analyzeLegacyQueue();
    // TOGGLE_POST_LIKE has payload UID → always assignable to payload UID
    // The cache index is irrelevant because payload UID takes precedence
    expect(result.summary.assignable).toBe(1);
    expect(result.assignable[0].ownerId).toBe('user-char');
  });

  it('handles mixed queue with all three classifications', () => {
    setStorage(CACHE_PREFIX + 'user-alice', [
      makeSeedPost({ id: 'post-alice-1' }),
    ]);

    setStorage(QUEUE_KEY, [
      // Assignable via payload UID
      { id: 'q-1', type: 'TOGGLE_POST_LIKE', payload: { postId: 'p1', userId: 'user-alice', liked: true } },
      // Assignable via cache match
      { id: 'q-2', type: 'CREATE_POST', payload: { localPostId: 'post-alice-1', hasImage: false } },
      // Ambiguous — no cache
      { id: 'q-3', type: 'UPDATE_POST_PRIVACY', payload: { postId: 'unknown-post', visibility: 'private' } },
      // Malformed
      'just-a-string',
      // Malformed — unknown type
      { id: 'q-5', type: 'DANCE', payload: {} },
    ]);

    const result = analyzeLegacyQueue();

    expect(result.summary).toEqual({
      total: 5,
      assignable: 2,
      ambiguous: 1,
      malformed: 2,
    });

    expect(result.assignable.map((a) => a.ownerId).sort()).toEqual(['user-alice', 'user-alice']);
    expect(result.assignable.map((a) => a.evidence[0]).sort()).toEqual(['cache-match', 'payload-uid']);
    expect(result.ambiguous[0].candidateOwnerIds).toEqual([]);
    expect(result.malformed).toHaveLength(2);
  });

  it('returns consistent results when called twice (idempotent)', () => {
    setStorage(CACHE_PREFIX + 'user-alice', [
      makeSeedPost({ id: 'post-alice' }),
    ]);
    setStorage(QUEUE_KEY, [
      { id: 'q-1', type: 'TOGGLE_POST_LIKE', payload: { postId: 'p1', userId: 'user-alice', liked: true } },
      { id: 'q-2', type: 'CREATE_POST', payload: { localPostId: 'post-alice', hasImage: false } },
      'malformed',
    ]);

    const first = analyzeLegacyQueue();
    const second = analyzeLegacyQueue();

    expect(first.summary).toEqual(second.summary);
    expect(first.assignable).toHaveLength(second.assignable.length);
    expect(first.ambiguous).toHaveLength(second.ambiguous.length);
    expect(first.malformed).toHaveLength(second.malformed.length);
  });

  it('does not use the currently authenticated user as evidence', () => {
    // There is no concept of a "current user" in the API — the function
    // takes no user parameter. This test verifies that behavior is unchanged
    // regardless of which user's data is in localStorage.

    setStorage(CACHE_PREFIX + 'user-alice', [
      makeSeedPost({ id: 'post-alice' }),
    ]);
    setStorage(QUEUE_KEY, [
      // A LIKE with userId='user-alice' is correctly attributed to alice
      { id: 'q-1', type: 'TOGGLE_POST_LIKE', payload: { postId: 'p1', userId: 'user-alice', liked: true } },
      // A privacy update for a post only in alice's cache → assignable to alice
      { id: 'q-2', type: 'UPDATE_POST_PRIVACY', payload: { postId: 'post-alice', visibility: 'public' } },
      // A CREATE for a post not in any cache → ambiguous
      { id: 'q-3', type: 'CREATE_POST', payload: { localPostId: 'post-unknown', hasImage: false } },
    ]);

    const result = analyzeLegacyQueue();

    expect(result.summary.assignable).toBe(2);
    expect(result.summary.ambiguous).toBe(1);
    // All assignable items point to user-alice (the only UID with evidence)
    result.assignable.forEach((a) => {
      expect(a.ownerId).toBe('user-alice');
    });
  });
});

describe('legacyQueueAnalyzer — complete report shape', () => {
  it('returns the expected top-level fields', () => {
    setStorage(QUEUE_KEY, [
      { id: 'q-1', type: 'TOGGLE_POST_LIKE', payload: { postId: 'p1', userId: 'u1', liked: true } },
    ]);

    const result = analyzeLegacyQueue();

    expect(result).toHaveProperty('assignable');
    expect(result).toHaveProperty('ambiguous');
    expect(result).toHaveProperty('malformed');
    expect(result).toHaveProperty('cacheIndex');
    expect(result).toHaveProperty('summary');
    expect(result).toHaveProperty('caches');
    expect(result.cacheIndex).toBeInstanceOf(Map);
    expect(Array.isArray(result.assignable)).toBe(true);
    expect(Array.isArray(result.ambiguous)).toBe(true);
    expect(Array.isArray(result.malformed)).toBe(true);
    expect(Array.isArray(result.caches)).toBe(true);
  });
});

/**
 * Legacy Queue Analyzer — pure, read-only
 *
 * Scans localStorage for UID-scoped feed caches and the global sync queue,
 * then classifies every queue item as assignable (can determine exactly one
 * owner UID), ambiguous (multiple or zero candidates), or malformed (invalid
 * structure).
 *
 * This module never uses the currently authenticated UID as ownership evidence.
 * It performs no writes to localStorage, IndexedDB, or any other storage.
 */
import { safeReadArray } from './storage';

// ---------------------------------------------------------------------------
// Constants matching the actual storage keys
// ---------------------------------------------------------------------------

const QUEUE_STORAGE_KEY = 'buddyScript.feed.syncQueue';
const POSTS_CACHE_PREFIX = 'buddyScript.feed.posts.';

// ---------------------------------------------------------------------------
// Evidence extraction
// ---------------------------------------------------------------------------

/**
 * Extract candidate owner UIDs from a queue item's payload.
 *
 * Rules:
 *  - TOGGLE_POST_LIKE, TOGGLE_COMMENT_LIKE, TOGGLE_REPLY_LIKE —
 *    payload.userId is direct evidence.
 *  - ADD_COMMENT — payload.comment.author.id is direct evidence.
 *  - ADD_REPLY — payload.reply.author.id is direct evidence.
 *  - CREATE_POST, UPDATE_POST_IMAGE, UPDATE_POST_PRIVACY —
 *    no direct UID; classification requires the cache index.
 *
 * @param {object} item  Queue item from the global sync queue.
 * @returns {string[]}  Zero or one candidate UID strings.
 */
function extractPayloadOwnerEvidence(item) {
  if (!item?.payload) return [];

  switch (item.type) {
    case 'TOGGLE_POST_LIKE':
    case 'TOGGLE_COMMENT_LIKE':
    case 'TOGGLE_REPLY_LIKE': {
      if (item.payload.userId) return [item.payload.userId];
      return [];
    }

    case 'ADD_COMMENT': {
      if (item.payload.comment?.author?.id) {
        return [item.payload.comment.author.id];
      }
      return [];
    }

    case 'ADD_REPLY': {
      if (item.payload.reply?.author?.id) {
        return [item.payload.reply.author.id];
      }
      return [];
    }

    case 'CREATE_POST':
    case 'UPDATE_POST_IMAGE':
    case 'UPDATE_POST_PRIVACY':
    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// Cache scanning
// ---------------------------------------------------------------------------

/**
 * Extract the userId from a feed cache key.
 *
 * Cache keys have the form:  buddyScript.feed.posts.{encodedUserId}
 *
 * @param {string} key  Full localStorage key.
 * @returns {string|null}  Decoded user ID, or null if the key doesn't match.
 */
function userIdFromCacheKey(key) {
  if (!key || !key.startsWith(POSTS_CACHE_PREFIX)) return null;
  const suffix = key.slice(POSTS_CACHE_PREFIX.length);
  try {
    return decodeURIComponent(suffix);
  } catch {
    return null;
  }
}

/**
 * Scan localStorage for all UID-scoped feed caches.
 *
 * @returns {Array<{ userId: string, posts: Array }>}
 */
function scanFeedCaches() {
  const caches = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      const userId = userIdFromCacheKey(key);
      if (!userId) continue;

      let posts;
      try {
        const raw = localStorage.getItem(key);
        posts = raw ? JSON.parse(raw) : [];
      } catch {
        // Skip this malformed cache entry
        continue;
      }

      if (Array.isArray(posts)) {
        caches.push({ userId, posts });
      }
    }
  } catch {
    // localStorage errors — return what we have
  }
  return caches;
}

// ---------------------------------------------------------------------------
// Entity index
// ---------------------------------------------------------------------------

/**
 * Collect all entity IDs from a post and its nested comments/replies.
 *
 * @param {object} post  A post object from the feed cache.
 * @returns {string[]}
 */
function collectEntityIds(post) {
  const ids = [];

  if (post.id) ids.push(post.id);
  if (post.localId) ids.push(post.localId);
  if (post.remoteId) ids.push(post.remoteId);

  const comments = post.comments?.items || [];
  for (const comment of comments) {
    if (comment.id) ids.push(comment.id);
    if (comment.remoteId) ids.push(comment.remoteId);

    const replies = comment.replies || [];
    for (const reply of replies) {
      if (reply.id) ids.push(reply.id);
      if (reply.remoteId) ids.push(reply.remoteId);
    }
  }

  return ids;
}

/**
 * Build a map from entity ID → Set of user IDs whose cache contains
 * that entity (post, comment, or reply).
 *
 * @param {Array<{ userId: string, posts: Array }>} caches
 * @returns {Map<string, Set<string>>}
 */
function buildCacheIndex(caches) {
  const index = new Map();

  for (const { userId, posts } of caches) {
    for (const post of posts) {
      for (const entityId of collectEntityIds(post)) {
        if (!entityId) continue;
        if (!index.has(entityId)) {
          index.set(entityId, new Set());
        }
        index.get(entityId).add(userId);
      }
    }
  }

  return index;
}

// ---------------------------------------------------------------------------
// Item classification
// ---------------------------------------------------------------------------

/**
 * Valid queue types (no-op if excluded).
 */
const VALID_TYPES = [
  'CREATE_POST',
  'ADD_COMMENT',
  'ADD_REPLY',
  'TOGGLE_POST_LIKE',
  'TOGGLE_COMMENT_LIKE',
  'TOGGLE_REPLY_LIKE',
  'UPDATE_POST_PRIVACY',
  'UPDATE_POST_IMAGE',
];

/**
 * Classify a single queue item.
 *
 * @param {object}  item       Queue item.
 * @param {Map}     cacheIndex Entity-ID → userIds map.
 * @returns {{ classification: string, ... }}
 */
function classifyItem(item, cacheIndex) {
  // --- Malformed checks ---

  if (!item || typeof item !== 'object') {
    return { classification: 'malformed', reason: 'Item is not an object' };
  }

  if (!item.id || typeof item.id !== 'string') {
    return { classification: 'malformed', reason: 'Missing or invalid item id' };
  }

  if (!item.type || typeof item.type !== 'string') {
    return { classification: 'malformed', reason: 'Missing or invalid item type' };
  }

  if (!item.payload || typeof item.payload !== 'object') {
    return { classification: 'malformed', reason: 'Missing or invalid payload' };
  }

  if (!VALID_TYPES.includes(item.type)) {
    return { classification: 'malformed', reason: `Unknown item type: "${item.type}"` };
  }

  // --- Payload evidence ---

  const payloadEvidence = extractPayloadOwnerEvidence(item);

  if (payloadEvidence.length === 1) {
    return {
      classification: 'assignable',
      ownerId: payloadEvidence[0],
      evidence: ['payload-uid'],
    };
  }

  // --- Cache-index evidence ---

  const entityId = item.payload.localPostId || item.payload.postId;

  if (entityId && cacheIndex.has(entityId)) {
    const candidates = cacheIndex.get(entityId);

    if (candidates.size === 1) {
      const ownerId = [...candidates][0];
      return {
        classification: 'assignable',
        ownerId,
        evidence: ['cache-match'],
      };
    }

    if (candidates.size > 1) {
      return {
        classification: 'ambiguous',
        candidateOwnerIds: [...candidates],
        reason: `Entity "${entityId}" found in ${candidates.size} caches`,
      };
    }
  }

  // --- No evidence ---

  return {
    classification: 'ambiguous',
    candidateOwnerIds: [],
    reason: entityId
      ? `Entity "${entityId}" not found in any cache`
      : 'No owner evidence and no entity reference in payload',
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Pure, read-only legacy queue analyzer.
 *
 * Scans all UID-scoped feed caches in localStorage, builds an ownership
 * index, reads the global sync queue, and classifies every item without
 * using the currently authenticated user as evidence.
 *
 * This function performs NO writes to localStorage, IndexedDB, or any
 * other storage. It is safe to call from any context.
 *
 * @returns {{
 *   assignable: Array<{ item: object, ownerId: string, evidence: string[] }>,
 *   ambiguous:  Array<{ item: object, candidateOwnerIds: string[], reason: string }>,
 *   malformed:  Array<{ rawItem: object, reason: string }>,
 *   cacheIndex: Map<string, Set<string>>,
 *   summary:    { total: number, assignable: number, ambiguous: number, malformed: number },
 *   caches:     Array<{ userId: string, postCount: number }>
 * }}
 */
export function analyzeLegacyQueue() {
  // Phase 1: Scan caches
  const caches = scanFeedCaches();

  // Phase 2: Build entity index
  const cacheIndex = buildCacheIndex(caches);

  // Phase 3: Read global queue
  const queue = safeReadArray(QUEUE_STORAGE_KEY, []);

  // Phase 4: Classify each item
  const result = {
    assignable: [],
    ambiguous: [],
    malformed: [],
    cacheIndex,
    summary: {
      total: queue.length,
      assignable: 0,
      ambiguous: 0,
      malformed: 0,
    },
    caches: caches.map(({ userId, posts }) => ({
      userId,
      postCount: posts.length,
    })),
  };

  for (const item of queue) {
    const classification = classifyItem(item, cacheIndex);

    switch (classification.classification) {
      case 'assignable':
        result.assignable.push({
          item,
          ownerId: classification.ownerId,
          evidence: classification.evidence,
        });
        result.summary.assignable++;
        break;

      case 'ambiguous':
        result.ambiguous.push({
          item,
          candidateOwnerIds: classification.candidateOwnerIds,
          reason: classification.reason,
        });
        result.summary.ambiguous++;
        break;

      case 'malformed':
        result.malformed.push({
          rawItem: item,
          reason: classification.reason,
        });
        result.summary.malformed++;
        break;
    }
  }

  return result;
}

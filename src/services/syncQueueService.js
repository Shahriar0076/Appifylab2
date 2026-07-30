import { safeReadArray, safeWriteJson, safeRemove } from '../utils/storage';

const QUEUE_STORAGE_KEY = 'buddyScript.feed.syncQueue';

// ---------------------------------------------------------------------------
// Queue item structure:
// {
//   id: 'queue-id',
//   type: 'CREATE_POST' | 'ADD_COMMENT' | 'ADD_REPLY' | 'TOGGLE_POST_LIKE' |
//          'TOGGLE_COMMENT_LIKE' | 'TOGGLE_REPLY_LIKE' | 'UPDATE_POST_PRIVACY' |
//          'UPDATE_POST_IMAGE',
//   payload: {},
//   status: 'pending' | 'syncing' | 'failed',
//   attempts: 0,
//   error: null,
//   createdAt: 'ISO string',
//   updatedAt: 'ISO string'
// }
// ---------------------------------------------------------------------------

/**
 * Safely read the sync queue from localStorage.
 * @returns {Array}
 */
export function readQueue() {
  return safeReadArray(QUEUE_STORAGE_KEY, []);
}

/**
 * Safely write the sync queue to localStorage.
 * @param {Array} queue
 * @returns {boolean} true if the write succeeded
 */
export function writeQueue(queue) {
  return safeWriteJson(QUEUE_STORAGE_KEY, queue);
}

let queueIdCounter = 0;

/**
 * Generate a unique queue item ID.
 */
function createQueueId() {
  queueIdCounter += 1;
  return `queue-${Date.now()}-${queueIdCounter}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Enqueue a new sync task.
 * @param {'CREATE_POST'|'ADD_COMMENT'|'ADD_REPLY'|'TOGGLE_POST_LIKE'|'TOGGLE_COMMENT_LIKE'|'TOGGLE_REPLY_LIKE'|'UPDATE_POST_PRIVACY'|'UPDATE_POST_IMAGE'} type
 * @param {object} payload
 * @returns {{ itemId: string|null, ok: boolean }} Queue item ID and whether it was persisted
 */
export function enqueue(type, payload) {
  const queue = readQueue();
  const item = {
    id: createQueueId(),
    type,
    payload,
    status: 'pending',
    attempts: 0,
    error: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  queue.push(item);
  const ok = writeQueue(queue);

  if (!ok) {
    // Queue write failed — item not persisted; provide a fallback ID
    return { itemId: item.id, ok: false };
  }

  // Wake up any sync processor that may be idle
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sync-queue-changed'));
  }

  return { itemId: item.id, ok: true };
}

/**
 * Mark a queue item as syncing.
 * @param {string} itemId
 */
export function markSyncing(itemId) {
  const queue = readQueue();
  const item = queue.find((q) => q.id === itemId);
  if (!item) return;

  item.status = 'syncing';
  item.updatedAt = new Date().toISOString();
  writeQueue(queue);
}

/**
 * Mark a queue item as synced (completed) and remove it.
 * @param {string} itemId
 */
export function markSynced(itemId) {
  let queue = readQueue();
  queue = queue.filter((q) => q.id !== itemId);
  writeQueue(queue);
}

/**
 * Mark a queue item as failed with an error.
 * @param {string} itemId
 * @param {string} errorMessage
 */
export function markFailed(itemId, errorMessage) {
  const queue = readQueue();
  const item = queue.find((q) => q.id === itemId);
  if (!item) return;

  item.status = 'failed';
  item.attempts = (item.attempts || 0) + 1;
  item.error = errorMessage;
  item.updatedAt = new Date().toISOString();
  writeQueue(queue);
}

/**
 * Get all pending queue items (including failed items that haven't exceeded max attempts,
 * and syncing items that may have been left stuck after a tab crash).
 * @param {number} maxAttempts - Maximum retry attempts (default 5)
 * @returns {Array}
 */
export function getPendingItems(maxAttempts = 5) {
  const queue = readQueue();
  return queue.filter(
    (item) =>
      item.status === 'pending' ||
      item.status === 'syncing' ||
      (item.status === 'failed' && (item.attempts || 0) < maxAttempts)
  );
}

/**
 * Get all failed items that have exceeded max retry attempts.
 * @param {number} maxAttempts
 * @returns {Array}
 */
export function getStuckItems(maxAttempts = 5) {
  const queue = readQueue();
  return queue.filter(
    (item) => item.status === 'failed' && (item.attempts || 0) >= maxAttempts
  );
}

/**
 * Clear the entire sync queue.
 */
export function clearQueue() {
  safeRemove(QUEUE_STORAGE_KEY);
}

/**
 * Retry backoff: returns delay in ms for a given attempt number.
 * Sequence: 2s, 5s, 15s, 60s, 300s
 * @param {number} attempt - 0-based attempt
 * @returns {number}
 */
export function getBackoffDelay(attempt) {
  const delays = [2000, 5000, 15000, 60000, 300000];
  return delays[Math.min(attempt, delays.length - 1)];
}

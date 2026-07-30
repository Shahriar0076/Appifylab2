import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  enqueue,
  readQueue,
  writeQueue,
  markSyncing,
  markSynced,
  markFailed,
  getPendingItems,
  getStuckItems,
  clearQueue,
  getBackoffDelay,
} from '../syncQueueService';

const QUEUE_KEY = 'buddyScript.feed.syncQueue';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// readQueue / writeQueue
// ---------------------------------------------------------------------------

describe('readQueue and writeQueue', () => {
  it('readQueue returns empty array when no key exists', () => {
    expect(readQueue()).toEqual([]);
  });

  it('writeQueue returns true on success', () => {
    expect(writeQueue([])).toBe(true);
  });

  it('writeQueue persists items that readQueue can retrieve', () => {
    const items = [{ id: 'q-1', type: 'CREATE_POST' }];
    writeQueue(items);
    expect(readQueue()).toEqual(items);
  });

  it('readQueue returns empty array for corrupt data', () => {
    localStorage.setItem(QUEUE_KEY, 'not-json');
    expect(readQueue()).toEqual([]);
  });

  it('readQueue returns empty array for non-array JSON', () => {
    localStorage.setItem(QUEUE_KEY, '{"type":"object"}');
    expect(readQueue()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// enqueue
// ---------------------------------------------------------------------------

describe('enqueue', () => {
  it('adds an item to the queue and returns itemId and ok:true', () => {
    const result = enqueue('CREATE_POST', { localPostId: 'post-abc', hasImage: false });
    expect(result.ok).toBe(true);
    expect(result.itemId).toMatch(/^queue-/);
  });

  it('adds an item with correct fields', () => {
    enqueue('TOGGLE_POST_LIKE', { postId: 'post-abc', userId: 'user-a', liked: true });
    const queue = readQueue();
    expect(queue).toHaveLength(1);
    const item = queue[0];
    expect(item.type).toBe('TOGGLE_POST_LIKE');
    expect(item.payload).toEqual({ postId: 'post-abc', userId: 'user-a', liked: true });
    expect(item.status).toBe('pending');
    expect(item.attempts).toBe(0);
    expect(item.error).toBeNull();
    expect(typeof item.createdAt).toBe('string');
    expect(typeof item.updatedAt).toBe('string');
  });

  it('dispatches sync-queue-changed event on enqueue', () => {
    let dispatched = false;
    const handler = () => { dispatched = true; };
    window.addEventListener('sync-queue-changed', handler);
    enqueue('CREATE_POST', { localPostId: 'post-1', hasImage: false });
    expect(dispatched).toBe(true);
    window.removeEventListener('sync-queue-changed', handler);
  });

  it('generates unique IDs for each enqueue', () => {
    const r1 = enqueue('CREATE_POST', { localPostId: 'a', hasImage: false });
    const r2 = enqueue('CREATE_POST', { localPostId: 'b', hasImage: false });
    expect(r1.itemId).not.toBe(r2.itemId);
  });
});

// ---------------------------------------------------------------------------
// markSyncing
// ---------------------------------------------------------------------------

describe('markSyncing', () => {
  it('marks a pending item as syncing', () => {
    const { itemId } = enqueue('CREATE_POST', { localPostId: 'post-abc', hasImage: false });
    markSyncing(itemId);
    const item = readQueue().find((q) => q.id === itemId);
    expect(item.status).toBe('syncing');
    // updatedAt is a non-empty ISO string
    expect(typeof item.updatedAt).toBe('string');
    expect(item.updatedAt.length).toBeGreaterThan(0);
  });

  it('does nothing for nonexistent itemId', () => {
    markSyncing('nonexistent');
    expect(readQueue()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// markSynced
// ---------------------------------------------------------------------------

describe('markSynced', () => {
  it('removes the item from the queue', () => {
    const { itemId } = enqueue('CREATE_POST', { localPostId: 'post-abc', hasImage: false });
    expect(readQueue()).toHaveLength(1);
    markSynced(itemId);
    expect(readQueue()).toHaveLength(0);
  });

  it('does nothing for nonexistent itemId', () => {
    markSynced('nonexistent');
    expect(readQueue()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// markFailed
// ---------------------------------------------------------------------------

describe('markFailed', () => {
  it('marks a pending item as failed and increments attempts', () => {
    const { itemId } = enqueue('CREATE_POST', { localPostId: 'post-abc', hasImage: false });
    markFailed(itemId, 'Network error');
    const item = readQueue().find((q) => q.id === itemId);
    expect(item.status).toBe('failed');
    expect(item.attempts).toBe(1);
    expect(item.error).toBe('Network error');
  });

  it('increments attempts on repeated failure', () => {
    const { itemId } = enqueue('CREATE_POST', { localPostId: 'post-abc', hasImage: false });
    markFailed(itemId, 'Error 1');
    markFailed(itemId, 'Error 2');
    const item = readQueue().find((q) => q.id === itemId);
    expect(item.attempts).toBe(2);
  });

  it('does nothing for nonexistent itemId', () => {
    markFailed('nonexistent', 'err');
    expect(readQueue()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getPendingItems
// ---------------------------------------------------------------------------

describe('getPendingItems', () => {
  it('returns pending items', () => {
    enqueue('CREATE_POST', { localPostId: 'p1', hasImage: false });
    enqueue('ADD_COMMENT', { postId: 'p1', comment: {} });
    expect(getPendingItems()).toHaveLength(2);
  });

  it('returns syncing items (for crash recovery)', () => {
    const { itemId } = enqueue('CREATE_POST', { localPostId: 'p1', hasImage: false });
    markSyncing(itemId);
    const pending = getPendingItems();
    expect(pending).toHaveLength(1);
    expect(pending[0].status).toBe('syncing');
  });

  it('returns failed items below max attempts', () => {
    const { itemId } = enqueue('CREATE_POST', { localPostId: 'p1', hasImage: false });
    markFailed(itemId, 'temp error');
    expect(getPendingItems()).toHaveLength(1);
  });

  it('excludes failed items at or above max attempts', () => {
    const { itemId } = enqueue('CREATE_POST', { localPostId: 'p1', hasImage: false });
    for (let i = 0; i < 5; i++) {
      markFailed(itemId, `error ${i}`);
    }
    expect(getPendingItems()).toHaveLength(0);
    // KNOWN DEFECT: getPendingItems checks `attempts < maxAttempts`, so
    // after exactly 5 attempts, the item transitions from "returned" (at 4)
    // to "excluded" (at 5). This matches the spec but means maxAttempts=5
    // gives 5 total tries (0-indexed attempts 0-4).
  });

  it('respects custom maxAttempts parameter', () => {
    const { itemId } = enqueue('CREATE_POST', { localPostId: 'p1', hasImage: false });
    markFailed(itemId, 'err');
    expect(getPendingItems(1)).toHaveLength(0);
    expect(getPendingItems(2)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// getStuckItems
// ---------------------------------------------------------------------------

describe('getStuckItems', () => {
  it('returns items that have exceeded max attempts', () => {
    const { itemId } = enqueue('CREATE_POST', { localPostId: 'p1', hasImage: false });
    for (let i = 0; i < 5; i++) {
      markFailed(itemId, `error ${i}`);
    }
    const stuck = getStuckItems();
    expect(stuck).toHaveLength(1);
    expect(stuck[0].id).toBe(itemId);
  });

  it('does not return pending items', () => {
    enqueue('CREATE_POST', { localPostId: 'p1', hasImage: false });
    expect(getStuckItems()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// clearQueue
// ---------------------------------------------------------------------------

describe('clearQueue', () => {
  it('removes all items', () => {
    enqueue('CREATE_POST', { localPostId: 'p1', hasImage: false });
    enqueue('TOGGLE_POST_LIKE', { postId: 'p1', userId: 'u1', liked: true });
    clearQueue();
    expect(readQueue()).toEqual([]);
  });

  it('handles empty queue', () => {
    clearQueue();
    expect(readQueue()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getBackoffDelay
// ---------------------------------------------------------------------------

describe('getBackoffDelay', () => {
  it('returns 2000ms for attempt 0', () => {
    expect(getBackoffDelay(0)).toBe(2000);
  });

  it('returns 5000ms for attempt 1', () => {
    expect(getBackoffDelay(1)).toBe(5000);
  });

  it('returns 15000ms for attempt 2', () => {
    expect(getBackoffDelay(2)).toBe(15000);
  });

  it('returns 60000ms for attempt 3', () => {
    expect(getBackoffDelay(3)).toBe(60000);
  });

  it('returns 300000ms for attempt 4', () => {
    expect(getBackoffDelay(4)).toBe(300000);
  });

  it('clamps to max delay for higher attempts', () => {
    expect(getBackoffDelay(5)).toBe(300000);
    expect(getBackoffDelay(100)).toBe(300000);
  });
});

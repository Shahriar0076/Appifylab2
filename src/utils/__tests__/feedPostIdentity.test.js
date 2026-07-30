import { describe, it, expect } from 'vitest';
import { getRemotePostId } from '../feedPostIdentity';

describe('getRemotePostId', () => {
  it('returns remoteId when present', () => {
    const post = { id: 'post-abc', remoteId: 'firestore-id-123', syncStatus: 'synced' };
    expect(getRemotePostId(post)).toBe('firestore-id-123');
  });

  it('returns null for a pending post', () => {
    const post = { id: 'post-abc', remoteId: null, syncStatus: 'pending' };
    expect(getRemotePostId(post)).toBeNull();
  });

  it('returns null for a failed post', () => {
    const post = { id: 'post-abc', remoteId: null, syncStatus: 'failed', syncError: 'timeout' };
    expect(getRemotePostId(post)).toBeNull();
  });

  it('returns null for a post with id starting with post-', () => {
    const post = { id: 'post-abc', remoteId: null, syncStatus: 'synced' };
    expect(getRemotePostId(post)).toBeNull();
  });

  it('returns null when post is null or undefined', () => {
    expect(getRemotePostId(null)).toBeNull();
    expect(getRemotePostId(undefined)).toBeNull();
  });

  it('returns null when post has no id', () => {
    expect(getRemotePostId({ syncStatus: 'synced' })).toBeNull();
  });

  // KNOWN DEFECT: When a seed post has id that doesn't start with 'post-' and
  // its syncStatus is 'synced', the id itself is treated as the remote doc ID.
  // This means seed post IDs must match their Firestore document IDs.
  it('returns id for synced posts with non-post- prefix', () => {
    const post = { id: 'seed-post-1', remoteId: null, syncStatus: 'synced' };
    expect(getRemotePostId(post)).toBe('seed-post-1');
  });

  it('returns remoteId even when syncStatus is synced', () => {
    const post = { id: 'post-abc', remoteId: 'doc-456', syncStatus: 'synced' };
    expect(getRemotePostId(post)).toBe('doc-456');
  });
});

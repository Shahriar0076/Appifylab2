import { describe, it, expect } from 'vitest';
import {
  toggleLikes,
  updatePost,
  findPost,
  appendComment,
  appendReply,
  togglePostLike,
  toggleCommentLike,
  toggleReplyLike,
  updatePostPrivacy,
} from '../feedMutations';

// ---------------------------------------------------------------------------
// Shared fixture helpers
// ---------------------------------------------------------------------------

function makePost(overrides = {}) {
  return {
    id: 'post-1',
    title: 'Test post',
    visibility: 'public',
    syncStatus: 'synced',
    likes: { count: 0, likedByCurrentUser: false, previewUsers: [] },
    comments: { previousCount: 0, items: [] },
    author: { id: 'user-a', name: 'Alice', initials: 'A', avatarColor: '#FF5733' },
    ...overrides,
  };
}

function makeComment(overrides = {}) {
  return {
    id: 'comment-1',
    text: 'A comment',
    syncStatus: 'synced',
    likes: { count: 0, likedByCurrentUser: false },
    replies: [],
    author: { id: 'user-b', name: 'Bob', initials: 'B', avatarColor: '#1890FF' },
    ...overrides,
  };
}

function makeReply(overrides = {}) {
  return {
    id: 'reply-1',
    text: 'A reply',
    syncStatus: 'synced',
    likes: { count: 0, likedByCurrentUser: false },
    author: { id: 'user-a', name: 'Alice', initials: 'A', avatarColor: '#FF5733' },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// toggleLikes
// ---------------------------------------------------------------------------

describe('toggleLikes', () => {
  it('flips likedByCurrentUser from false to true', () => {
    const result = toggleLikes({ count: 3, likedByCurrentUser: false });
    expect(result.likedByCurrentUser).toBe(true);
    expect(result.count).toBe(4);
  });

  it('flips likedByCurrentUser from true to false', () => {
    const result = toggleLikes({ count: 4, likedByCurrentUser: true });
    expect(result.likedByCurrentUser).toBe(false);
    expect(result.count).toBe(3);
  });

  it('never goes below zero', () => {
    const result = toggleLikes({ count: 0, likedByCurrentUser: true });
    expect(result.count).toBe(0);
  });

  it('handles undefined/null by defaulting', () => {
    const result = toggleLikes(undefined);
    expect(result.likedByCurrentUser).toBe(true);
    expect(result.count).toBe(1);
  });

  it('preserves extra properties', () => {
    const result = toggleLikes({ count: 0, likedByCurrentUser: false, previewUsers: [] });
    expect(result).toHaveProperty('previewUsers');
    expect(Array.isArray(result.previewUsers)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// updatePost
// ---------------------------------------------------------------------------

describe('updatePost', () => {
  it('updates a post by id using an updater function', () => {
    const posts = [makePost({ id: 'p1' }), makePost({ id: 'p2' })];
    const result = updatePost(posts, 'p1', (p) => ({ ...p, title: 'Updated' }));
    expect(result.find((p) => p.id === 'p1').title).toBe('Updated');
    expect(result.find((p) => p.id === 'p2').title).toBe('Test post');
  });

  it('returns a new array without mutating the original', () => {
    const posts = [makePost()];
    const result = updatePost(posts, 'post-1', (p) => ({ ...p, title: 'New' }));
    expect(result).not.toBe(posts);
    expect(posts[0].title).toBe('Test post');
  });

  it('does nothing when postId does not exist', () => {
    const posts = [makePost()];
    const result = updatePost(posts, 'nonexistent', (p) => ({ ...p, title: 'X' }));
    expect(result).toEqual(posts);
  });
});

// ---------------------------------------------------------------------------
// findPost
// ---------------------------------------------------------------------------

describe('findPost', () => {
  it('returns the matching post', () => {
    const posts = [makePost({ id: 'p1' }), makePost({ id: 'p2' })];
    expect(findPost(posts, 'p1').id).toBe('p1');
  });

  it('returns undefined when no match', () => {
    expect(findPost([makePost()], 'nonexistent')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// appendComment
// ---------------------------------------------------------------------------

describe('appendComment', () => {
  it('appends a comment to the correct post', () => {
    const posts = [makePost({ id: 'p1' })];
    const comment = makeComment({ id: 'c1' });
    const result = appendComment(posts, 'p1', comment);
    expect(result[0].comments.items).toHaveLength(1);
    expect(result[0].comments.items[0].id).toBe('c1');
  });

  it('handles posts with missing comments structure', () => {
    const posts = [{ id: 'p1' }];
    const comment = makeComment({ id: 'c1' });
    const result = appendComment(posts, 'p1', comment);
    expect(result[0].comments.items).toHaveLength(1);
    expect(result[0].comments.previousCount).toBe(0);
  });

  it('does not mutate the original posts array', () => {
    const posts = [makePost()];
    const comment = makeComment();
    appendComment(posts, 'post-1', comment);
    expect(posts[0].comments.items).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// appendReply
// ---------------------------------------------------------------------------

describe('appendReply', () => {
  it('appends a reply to the correct comment within a post', () => {
    const posts = [makePost({ comments: { previousCount: 0, items: [makeComment({ id: 'c1' })] } })];
    const reply = makeReply({ id: 'r1' });
    const result = appendReply(posts, 'post-1', 'c1', reply);
    expect(result[0].comments.items[0].replies).toHaveLength(1);
    expect(result[0].comments.items[0].replies[0].id).toBe('r1');
  });

  it('handles comments with undefined replies array', () => {
    const posts = [makePost({ comments: { previousCount: 0, items: [{ id: 'c1', text: 'x' }] } })];
    const reply = makeReply({ id: 'r1' });
    const result = appendReply(posts, 'post-1', 'c1', reply);
    expect(result[0].comments.items[0].replies).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// togglePostLike
// ---------------------------------------------------------------------------

describe('togglePostLike', () => {
  it('toggles like state on the matching post', () => {
    const posts = [makePost()];
    const result = togglePostLike(posts, 'post-1');
    expect(result[0].likes.likedByCurrentUser).toBe(true);
    expect(result[0].likes.count).toBe(1);
  });

  it('toggles off on second call', () => {
    const posts = [makePost({ likes: { count: 1, likedByCurrentUser: true, previewUsers: [{ id: 'user-a' }] } })];
    const result = togglePostLike(posts, 'post-1');
    expect(result[0].likes.likedByCurrentUser).toBe(false);
    expect(result[0].likes.count).toBe(0);
  });

  it('adds currentUser to previewUsers when liking', () => {
    const currentUser = { id: 'user-a', name: 'Alice', initials: 'A', avatarColor: '#FF5733' };
    const posts = [makePost()];
    const result = togglePostLike(posts, 'post-1', currentUser);
    expect(result[0].likes.previewUsers).toContainEqual(currentUser);
  });

  it('removes currentUser from previewUsers when unliking', () => {
    const currentUser = { id: 'user-a', name: 'Alice', initials: 'A', avatarColor: '#FF5733' };
    const posts = [makePost({ likes: { count: 1, likedByCurrentUser: true, previewUsers: [currentUser] } })];
    const result = togglePostLike(posts, 'post-1', currentUser);
    expect(result[0].likes.previewUsers).not.toContainEqual(currentUser);
    expect(result[0].likes.previewUsers).toHaveLength(0);
  });

  // KNOWN DEFECT: previewUsers truncation at 6 may mismatch remote after sync.
  // This is the current behavior being characterized.
  it('limits previewUsers to 6 entries', () => {
    const currentUser = { id: 'user-a', name: 'A' };
    const existing = Array.from({ length: 6 }, (_, i) => ({ id: `user-${i}`, name: `U${i}` }));
    const posts = [makePost({ likes: { count: 6, likedByCurrentUser: false, previewUsers: existing } })];
    const result = togglePostLike(posts, 'post-1', currentUser);
    expect(result[0].likes.previewUsers).toHaveLength(6);
  });
});

// ---------------------------------------------------------------------------
// toggleCommentLike
// ---------------------------------------------------------------------------

describe('toggleCommentLike', () => {
  it('toggles like on a comment within a post', () => {
    const posts = [makePost({ comments: { previousCount: 0, items: [makeComment({ id: 'c1' })] } })];
    const result = toggleCommentLike(posts, 'post-1', 'c1');
    expect(result[0].comments.items[0].likes.likedByCurrentUser).toBe(true);
    expect(result[0].comments.items[0].likes.count).toBe(1);
  });

  it('handles posts with missing comments structure', () => {
    const posts = [{ id: 'post-1' }];
    const result = toggleCommentLike(posts, 'post-1', 'c1');
    expect(result[0].comments.items).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// toggleReplyLike
// ---------------------------------------------------------------------------

describe('toggleReplyLike', () => {
  it('toggles like on a reply within a comment within a post', () => {
    const posts = [
      makePost({
        comments: {
          previousCount: 0,
          items: [
            makeComment({
              id: 'c1',
              replies: [makeReply({ id: 'r1' })],
            }),
          ],
        },
      }),
    ];
    const result = toggleReplyLike(posts, 'post-1', 'c1', 'r1');
    expect(result[0].comments.items[0].replies[0].likes.likedByCurrentUser).toBe(true);
    expect(result[0].comments.items[0].replies[0].likes.count).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// updatePostPrivacy
// ---------------------------------------------------------------------------

describe('updatePostPrivacy', () => {
  it('changes visibility on the matching post', () => {
    const posts = [makePost({ visibility: 'public' })];
    const result = updatePostPrivacy(posts, 'post-1', 'private');
    expect(result[0].visibility).toBe('private');
  });

  it('does not modify other posts', () => {
    const posts = [makePost({ id: 'p1', visibility: 'public' }), makePost({ id: 'p2', visibility: 'public' })];
    const result = updatePostPrivacy(posts, 'p1', 'private');
    expect(result[0].visibility).toBe('private');
    expect(result[1].visibility).toBe('public');
  });
});

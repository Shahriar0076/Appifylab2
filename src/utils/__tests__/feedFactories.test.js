import { describe, it, expect } from 'vitest';
import {
  createId,
  normalizeUser,
  createLocalPost,
  createLocalComment,
  createLocalReply,
  normalizeSeedPost,
  normalizeSeedPosts,
} from '../feedFactories';

describe('createId', () => {
  it('returns a string with the given prefix and a hyphen', () => {
    const id = createId('post');
    expect(id).toMatch(/^post-/);
  });

  it('returns a string with the given prefix for comment', () => {
    const id = createId('comment');
    expect(id).toMatch(/^comment-/);
  });

  it('returns different values on successive calls', () => {
    const a = createId('test');
    const b = createId('test');
    expect(a).not.toBe(b);
  });

  it('does not contain forward slashes', () => {
    const id = createId('post');
    expect(id).not.toContain('/');
  });
});

describe('normalizeUser', () => {
  it('extracts id, name, initials, avatarColor from a user object', () => {
    const user = {
      id: 'user-abc',
      name: 'Alice',
      initials: 'A',
      avatarColor: '#FF5733',
    };
    expect(normalizeUser(user)).toEqual({
      id: 'user-abc',
      name: 'Alice',
      initials: 'A',
      avatarColor: '#FF5733',
    });
  });

  it('preserves extra fields that may exist', () => {
    const user = {
      id: 'user-xyz',
      name: 'Bob',
      initials: 'B',
      avatarColor: '#1890FF',
      email: 'bob@example.com',
    };
    const result = normalizeUser(user);
    expect(result.id).toBe('user-xyz');
    expect(result.name).toBe('Bob');
    // Extra fields are not included by current implementation
    expect(result.email).toBeUndefined();
  });
});

describe('createLocalPost', () => {
  const author = { id: 'user-a', name: 'Alice', initials: 'A', avatarColor: '#FF5733' };

  it('creates a pending post with text and public privacy', () => {
    const post = createLocalPost({
      id: 'post-abc',
      author,
      content: 'Hello world',
      privacy: 'public',
      imagePath: null,
    });

    expect(post.id).toBe('post-abc');
    expect(post.syncStatus).toBe('pending');
    expect(post.syncError).toBeNull();
    expect(post.remoteId).toBeNull();
    expect(post.title).toBe('Hello world');
    expect(post.visibility).toBe('public');
    expect(post.image).toBeNull();
    expect(post.imageUploadStatus).toBe('none');
    expect(post.imageRemoteUrl).toBeNull();
    expect(post.imagePublicId).toBeNull();
    expect(post.author).toEqual(author);
    expect(post.likes).toEqual({ count: 0, likedByCurrentUser: false, previewUsers: [] });
    expect(post.comments).toEqual({ previousCount: 0, items: [] });
    expect(post.displayTime).toBe('now');
    expect(typeof post.createdAt).toBe('string');
  });

  it('creates a pending post with private privacy', () => {
    const post = createLocalPost({
      id: 'post-def',
      author,
      content: 'Private post',
      privacy: 'private',
      imagePath: null,
    });
    expect(post.visibility).toBe('private');
  });

  it('sets imageUploadStatus to pending when imagePath is provided', () => {
    const post = createLocalPost({
      id: 'post-img',
      author,
      content: 'With image',
      privacy: 'public',
      imagePath: '/uploads/post-img.jpg',
    });
    expect(post.imageUploadStatus).toBe('pending');
    expect(post.image).toBe('/uploads/post-img.jpg');
  });

  it('handles empty content gracefully', () => {
    const post = createLocalPost({
      id: 'post-empty',
      author,
      content: '',
      privacy: 'public',
      imagePath: null,
    });
    expect(post.title).toBe('');
  });
});

describe('createLocalComment', () => {
  const author = { id: 'user-a', name: 'Alice', initials: 'A', avatarColor: '#FF5733' };

  it('creates a pending comment with text, likes, replies array', () => {
    const comment = createLocalComment({
      id: 'comment-abc',
      author,
      text: 'Nice post!',
    });

    expect(comment.id).toBe('comment-abc');
    expect(comment.syncStatus).toBe('pending');
    expect(comment.syncError).toBeNull();
    expect(comment.remoteId).toBeNull();
    expect(comment.author).toEqual(author);
    expect(comment.text).toBe('Nice post!');
    expect(comment.displayTime).toBe('now');
    expect(comment.likes).toEqual({ count: 0, likedByCurrentUser: false });
    expect(comment.replies).toEqual([]);
  });
});

describe('createLocalReply', () => {
  const author = { id: 'user-b', name: 'Bob', initials: 'B', avatarColor: '#1890FF' };

  it('creates a pending reply without replies array', () => {
    // KNOWN: Unlike createLocalComment, createLocalReply does not include a `replies: []` field.
    // This is because replies are not nested beyond one level.
    const reply = createLocalReply({
      id: 'reply-abc',
      author,
      text: 'Thanks!',
    });

    expect(reply.id).toBe('reply-abc');
    expect(reply.syncStatus).toBe('pending');
    expect(reply.syncError).toBeNull();
    expect(reply.remoteId).toBeNull();
    expect(reply.author).toEqual(author);
    expect(reply.text).toBe('Thanks!');
    expect(reply.displayTime).toBe('now');
    expect(reply.likes).toEqual({ count: 0, likedByCurrentUser: false });
    expect(reply.replies).toBeUndefined();
  });
});

describe('normalizeSeedPost', () => {
  it('adds sync/image tracking fields to a seed post', () => {
    const seed = {
      id: 'post-seed-1',
      title: 'Seed post',
      visibility: 'public',
      author: { id: 'user-dylan', name: 'Dylan', initials: 'D', avatarColor: '#1890FF' },
      likes: { count: 5, likedByCurrentUser: false, previewUsers: [] },
      comments: { previousCount: 1, items: [] },
    };

    const normalized = normalizeSeedPost(seed);

    expect(normalized.id).toBe('post-seed-1');
    expect(normalized.remoteId).toBeNull();
    expect(normalized.syncStatus).toBe('synced');
    expect(normalized.syncError).toBeNull();
    expect(normalized.imageUploadStatus).toBe('none');
    expect(normalized.imageRemoteUrl).toBeNull();
    expect(normalized.imagePublicId).toBeNull();
    expect(normalized.visibility).toBe('public');
    expect(normalized.title).toBe('Seed post');
  });

  it('preserves all original fields', () => {
    const seed = {
      id: 'post-seed-2',
      title: 'Original',
      visibility: 'private',
      author: { id: 'user-x', name: 'X', initials: 'X', avatarColor: '#000' },
      likes: { count: 0, likedByCurrentUser: false, previewUsers: [] },
      comments: { previousCount: 0, items: [] },
      image: 'photo.png',
    };

    const normalized = normalizeSeedPost(seed);
    expect(normalized.image).toBe('photo.png');
    expect(normalized.author.name).toBe('X');
  });
});

describe('normalizeSeedPosts', () => {
  it('normalizes an array of seed posts', () => {
    const seeds = [
      { id: 'a', title: 'A', visibility: 'public', author: {}, likes: {}, comments: {} },
      { id: 'b', title: 'B', visibility: 'private', author: {}, likes: {}, comments: {} },
    ];
    const result = normalizeSeedPosts(seeds);
    expect(result).toHaveLength(2);
    expect(result[0].syncStatus).toBe('synced');
    expect(result[1].syncStatus).toBe('synced');
  });

  it('handles empty array', () => {
    expect(normalizeSeedPosts([])).toEqual([]);
  });
});

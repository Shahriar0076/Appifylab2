let idCounter = 0;

/**
 * Generate a unique ID with the given prefix.
 * Uses crypto.randomUUID when available, falls back to a timestamp+counter combo.
 * @param {string} prefix
 * @returns {string}
 */
export function createId(prefix) {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  idCounter += 1;
  return `${prefix}-${Date.now()}-${idCounter}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Normalize a currentUser object to a minimal author shape.
 * @param {object} currentUser
 * @returns {{ id, name, initials, avatarColor }}
 */
export function normalizeUser(currentUser) {
  return {
    id: currentUser.id,
    name: currentUser.name,
    initials: currentUser.initials,
    avatarColor: currentUser.avatarColor,
  };
}

/**
 * Create a local post object for optimistic UI insertion.
 * @param {object} params
 * @param {string} params.id
 * @param {object} params.author - normalized author
 * @param {string} params.content
 * @param {string} params.privacy - 'public' | 'private'
 * @param {string|null} params.imagePath
 * @returns {object}
 */
export function createLocalPost({ id, author, content, privacy, imagePath }) {
  return {
    id,
    remoteId: null,
    syncStatus: 'pending',
    syncError: null,
    imageUploadStatus: imagePath ? 'pending' : 'none',
    imageRemoteUrl: null,
    imagePublicId: null,
    author,
    createdAt: new Date().toISOString(),
    displayTime: 'now',
    visibility: privacy,
    title: content || '',
    image: imagePath,
    likes: { count: 0, likedByCurrentUser: false, previewUsers: [] },
    comments: { previousCount: 0, items: [] },
  };
}

/**
 * Create a local comment object for optimistic UI insertion.
 * @param {object} params
 * @param {string} params.id
 * @param {object} params.author - normalized author
 * @param {string} params.text
 * @returns {object}
 */
export function createLocalComment({ id, author, text }) {
  return {
    id,
    remoteId: null,
    syncStatus: 'pending',
    syncError: null,
    author,
    text,
    displayTime: 'now',
    likes: { count: 0, likedByCurrentUser: false },
    replies: [],
  };
}

/**
 * Create a local reply object for optimistic UI insertion.
 * Relies on createLocalComment internally since they share shape.
 * @param {object} params
 * @returns {object}
 */
export function createLocalReply({ id, author, text }) {
  return {
    id,
    remoteId: null,
    syncStatus: 'pending',
    syncError: null,
    author,
    text,
    displayTime: 'now',
    likes: { count: 0, likedByCurrentUser: false },
  };
}

/**
 * Normalize a seed post (from JSON) by adding sync/image tracking fields.
 * @param {object} post
 * @returns {object}
 */
export function normalizeSeedPost(post) {
  return {
    ...post,
    remoteId: null,
    syncStatus: 'synced',
    syncError: null,
    imageUploadStatus: 'none',
    imageRemoteUrl: null,
    imagePublicId: null,
  };
}

/**
 * Normalize an array of seed posts.
 * @param {Array} posts
 * @returns {Array}
 */
export function normalizeSeedPosts(posts) {
  return posts.map(normalizeSeedPost);
}

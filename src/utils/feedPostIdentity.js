/**
 * Resolve the Firestore document ID for both current and legacy cached posts.
 * Older cache entries stored a remote post's Firestore ID only in `id`.
 */
export function getRemotePostId(post) {
  if (post?.remoteId) return post.remoteId;
  if (!post?.id) return null;

  // Optimistic posts use a local ID until their first successful sync.
  if (post.syncStatus === 'pending' || post.syncStatus === 'failed') {
    return null;
  }

  if (String(post.id).startsWith('post-')) return null;

  return post.id;
}

/**
 * Toggle the liked state of a likes object.
 * Switches likedByCurrentUser and updates count accordingly.
 * @param {object} likes - { count, likedByCurrentUser, ... }
 * @returns {object} new likes object
 */
export function toggleLikes(likes = {}) {
  const likedByCurrentUser = !likes.likedByCurrentUser;
  const count = Math.max(0, (likes.count || 0) + (likedByCurrentUser ? 1 : -1));

  return {
    ...likes,
    count,
    likedByCurrentUser,
  };
}

// ---------------------------------------------------------------------------
// Immutable updaters for the posts[] array
// Each returns a new array; the original is not mutated.
// ---------------------------------------------------------------------------

/**
 * Update a post by postId using an updater function.
 * @param {Array} posts
 * @param {string} postId
 * @param {Function} updater - (post) => newPost
 * @returns {Array} new posts array
 */
export function updatePost(posts, postId, updater) {
  return posts.map((post) => (post.id === postId ? updater(post) : post));
}

/**
 * Find a post in the posts array (side-effect helper for closures).
 * @param {Array} posts
 * @param {string} postId
 * @returns {object|undefined}
 */
export function findPost(posts, postId) {
  return posts.find((p) => p.id === postId);
}

/**
 * Append a comment to a post's comment list.
 * @param {Array} posts
 * @param {string} postId
 * @param {object} comment
 * @returns {Array} new posts array
 */
export function appendComment(posts, postId, comment) {
  return posts.map((post) => {
    if (post.id !== postId) return post;
    const comments = post.comments || { previousCount: 0, items: [] };
    return {
      ...post,
      comments: {
        ...comments,
        items: [...(comments.items || []), comment],
      },
    };
  });
}

/**
 * Append a reply to a specific comment within a post.
 * @param {Array} posts
 * @param {string} postId
 * @param {string} commentId
 * @param {object} reply
 * @returns {Array} new posts array
 */
export function appendReply(posts, postId, commentId, reply) {
  return posts.map((post) => {
    if (post.id !== postId) return post;
    const comments = post.comments || { previousCount: 0, items: [] };
    return {
      ...post,
      comments: {
        ...comments,
        items: (comments.items || []).map((comment) =>
          comment.id === commentId
            ? { ...comment, replies: [...(comment.replies || []), reply] }
            : comment
        ),
      },
    };
  });
}

/**
 * Toggle the liked state of a post's likes.
 * @param {object} post
 * @returns {object} new post
 */
function togglePostLikes(post, currentUser = null) {
  const likes = toggleLikes(post.likes);
  const previewUsers = likes.previewUsers || [];

  if (!currentUser?.id) return { ...post, likes };

  return {
    ...post,
    likes: {
      ...likes,
      previewUsers: likes.likedByCurrentUser
        ? previewUsers.some((user) => user.id === currentUser.id)
          ? previewUsers
          : [currentUser, ...previewUsers].slice(0, 6)
        : previewUsers.filter((user) => user.id !== currentUser.id),
    },
  };
}

/**
 * Toggle the liked state of a comment's likes.
 * @param {object} comment
 * @returns {object} new comment
 */
function toggleCommentLikes(comment) {
  return { ...comment, likes: toggleLikes(comment.likes) };
}

/**
 * Toggle the liked state of a reply's likes.
 * @param {object} reply
 * @returns {object} new reply
 */
function toggleReplyLikes(reply) {
  return { ...reply, likes: toggleLikes(reply.likes) };
}

/**
 * Toggle like on a post.
 * @param {Array} posts
 * @param {string} postId
 * @returns {Array} new posts array
 */
export function togglePostLike(posts, postId, currentUser = null) {
  return updatePost(posts, postId, (post) => togglePostLikes(post, currentUser));
}

/**
 * Toggle like on a comment within a post.
 * @param {Array} posts
 * @param {string} postId
 * @param {string} commentId
 * @returns {Array} new posts array
 */
export function toggleCommentLike(posts, postId, commentId) {
  return posts.map((post) => {
    if (post.id !== postId) return post;
    const comments = post.comments || { previousCount: 0, items: [] };
    return {
      ...post,
      comments: {
        ...comments,
        items: (comments.items || []).map((comment) =>
          comment.id === commentId ? toggleCommentLikes(comment) : comment
        ),
      },
    };
  });
}

/**
 * Toggle like on a reply within a comment within a post.
 * @param {Array} posts
 * @param {string} postId
 * @param {string} commentId
 * @param {string} replyId
 * @returns {Array} new posts array
 */
export function toggleReplyLike(posts, postId, commentId, replyId) {
  return posts.map((post) => {
    if (post.id !== postId) return post;
    const comments = post.comments || { previousCount: 0, items: [] };
    return {
      ...post,
      comments: {
        ...comments,
        items: (comments.items || []).map((comment) =>
          comment.id === commentId
            ? {
                ...comment,
                replies: (comment.replies || []).map((reply) =>
                  reply.id === replyId ? toggleReplyLikes(reply) : reply
                ),
              }
            : comment
        ),
      },
    };
  });
}

/**
 * Update the visibility of a post.
 * @param {Array} posts
 * @param {string} postId
 * @param {string} visibility - 'public' | 'private'
 * @returns {Array} new posts array
 */
export function updatePostPrivacy(posts, postId, visibility) {
  return updatePost(posts, postId, (post) => ({ ...post, visibility }));
}

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  updateDoc,
  serverTimestamp,
  increment,
  runTransaction,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { formatRelativeTime } from '../utils/formatRelativeTime';

// ---------------------------------------------------------------------------
// User profile helpers for author snapshots
// ---------------------------------------------------------------------------

const userCache = new Map();

async function getUserSnapshot(uid) {
  if (userCache.has(uid)) return userCache.get(uid);

  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;

  const data = snap.data();
  const profile = {
    id: uid,
    name: `${data.firstName} ${data.lastName}`,
    initials: (data.firstName || '').charAt(0).toUpperCase(),
    avatarColor: data.avatarColor || '#1890FF',
    firstName: data.firstName,
    lastName: data.lastName,
  };

  userCache.set(uid, profile);
  return profile;
}

function buildAuthorSnapshot(user) {
  return {
    id: user.id,
    name: user.name,
    initials: user.initials,
    avatarColor: user.avatarColor,
    firstName: user.firstName || user.name?.split(' ')[0] || '',
    lastName: user.lastName || user.name?.split(' ').slice(1).join(' ') || '',
  };
}

// ---------------------------------------------------------------------------
// Post normalization (Firestore → UI contract)
// ---------------------------------------------------------------------------

function normalizeFirestorePost(docSnap, authorProfile) {
  const data = docSnap.data();
  const createdAtISO = data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString();
  // Normalize the Firestore post doc into the UI shape
  return {
    id: docSnap.id,
    remoteId: docSnap.id,
    localId: data.localId || null,
    author: authorProfile
      ? {
          id: authorProfile.id,
          name: authorProfile.name,
          initials: authorProfile.initials,
          avatarColor: authorProfile.avatarColor,
        }
      : { id: data.userId, name: 'Unknown', initials: '?', avatarColor: '#ccc' },
    createdAt: createdAtISO,
    displayTime: formatRelativeTime(createdAtISO),
    visibility: data.visibility || 'public',
    title: data.text || '',
    image: null, // Remote posts use imageRemoteUrl
    imageRemoteUrl: data.imageUrl || null,
    imagePublicId: data.imagePublicId || null,
    likes: {
      count: data.likesCount || 0,
      likedByCurrentUser: false,
      previewUsers: [],
    },
    comments: {
      previousCount: 0,
      items: [],
    },
  };
}

function _normalizeFirestoreComment(docSnap, postId, authorProfile) {
  const data = docSnap.data();
  const createdAtISO = data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString();
  return {
    id: docSnap.id,
    remoteId: docSnap.id,
    localId: data.localId || null,
    postId: data.postId || postId,
    author: authorProfile
      ? {
          id: authorProfile.id,
          name: authorProfile.name,
          initials: authorProfile.initials,
          avatarColor: authorProfile.avatarColor,
        }
      : { id: data.userId, name: 'Unknown', initials: '?', avatarColor: '#ccc' },
    text: data.text || '',
    displayTime: formatRelativeTime(createdAtISO),
    likes: {
      count: data.likesCount || 0,
      likedByCurrentUser: false,
    },
    replies: [],
  };
}

function _normalizeFirestoreReply(docSnap, postId, commentId, authorProfile) {
  const data = docSnap.data();
  const createdAtISO = data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString();
  return {
    id: docSnap.id,
    remoteId: docSnap.id,
    localId: data.localId || null,
    postId: data.postId || postId,
    commentId: data.commentId || commentId,
    author: authorProfile
      ? {
          id: authorProfile.id,
          name: authorProfile.name,
          initials: authorProfile.initials,
          avatarColor: authorProfile.avatarColor,
        }
      : { id: data.userId, name: 'Unknown', initials: '?', avatarColor: '#ccc' },
    text: data.text || '',
    displayTime: formatRelativeTime(createdAtISO),
    likes: {
      count: data.likesCount || 0,
      likedByCurrentUser: false,
    },
  };
}

// ---------------------------------------------------------------------------
// Fetch comments and replies for remote posts
// ---------------------------------------------------------------------------

/**
 * Fetch comments (and their replies) for a list of post IDs.
 * Firestore `in` queries are limited to 10 values, so postIds are batched.
 * @param {string[]} postIds
 * @returns {Promise<Map<string, Array>>} Map of postId → comment objects with nested replies
 */
async function fetchPostLikesForPosts(postIds, currentUserId) {
  const likesByPost = new Map();
  if (postIds.length === 0) return likesByPost;

  for (let i = 0; i < postIds.length; i += 10) {
    const batch = postIds.slice(i, i + 10);
    const q = query(
      collection(db, 'postLikes'),
      where('postId', 'in', batch)
    );
    const snap = await getDocs(q);

    for (const likeSnap of snap.docs) {
      const data = likeSnap.data();
      if (!likesByPost.has(data.postId)) likesByPost.set(data.postId, []);
      likesByPost.get(data.postId).push(data);
    }
  }

  for (const [postId, likes] of likesByPost) {
    likes.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || 0;
      const bTime = b.createdAt?.toMillis?.() || 0;
      return bTime - aTime;
    });

    const previewUsers = [];
    for (const like of likes.slice(0, 6)) {
      const profile = await getUserSnapshot(like.userId);
      if (profile) previewUsers.push(profile);
    }

    likesByPost.set(postId, {
      previewUsers,
      likedByCurrentUser: likes.some((like) => like.userId === currentUserId),
    });
  }

  // Done fetching likes per post
  return likesByPost;
}

/**
 * Subscribe to likes for the posts currently loaded in the feed.
 * Firestore `in` queries accept at most 10 values, so each group gets its own
 * listener and reports updates only for the post IDs in that group.
 */
export function subscribeToPostLikes({
  postIds,
  currentUserId,
  onChange,
  onError,
}) {
  const uniquePostIds = [...new Set(postIds.filter(Boolean))];
  if (uniquePostIds.length === 0) return () => {};

  let active = true;
  const unsubscribers = [];

  for (let i = 0; i < uniquePostIds.length; i += 10) {
    const batch = uniquePostIds.slice(i, i + 10);
    let snapshotVersion = 0;
    const likesQuery = query(
      collection(db, 'postLikes'),
      where('postId', 'in', batch)
    );

    const unsubscribe = onSnapshot(
      likesQuery,
      async (snapshot) => {
        const currentVersion = ++snapshotVersion;
        const rawLikesByPost = new Map(batch.map((postId) => [postId, []]));

        for (const likeSnap of snapshot.docs) {
          const like = likeSnap.data();
          if (rawLikesByPost.has(like.postId)) {
            rawLikesByPost.get(like.postId).push(like);
          }
        }

        const likesByPost = new Map();
        await Promise.all(
          batch.map(async (postId) => {
            const likes = rawLikesByPost.get(postId);
            likes.sort((a, b) => {
              const aTime = a.createdAt?.toMillis?.() || 0;
              const bTime = b.createdAt?.toMillis?.() || 0;
              return bTime - aTime;
            });

            const previewUsers = (
              await Promise.all(
                likes.slice(0, 6).map((like) => getUserSnapshot(like.userId))
              )
            ).filter(Boolean);

            likesByPost.set(postId, {
              count: likes.length,
              previewUsers,
              likedByCurrentUser: likes.some(
                (like) => like.userId === currentUserId
              ),
            });
          })
        );

        // Ignore an older async profile lookup if a newer snapshot arrived.
        if (active && currentVersion === snapshotVersion) {
          onChange(likesByPost);
        }
      },
      (error) => {
        if (active) onError?.(error);
      }
    );

    unsubscribers.push(unsubscribe);
  }

  return () => {
    active = false;
    unsubscribers.forEach((unsubscribe) => unsubscribe());
  };
}

/**
 * Fetch comment likes (likedByCurrentUser) for a batch of comment IDs.
 * @param {string[]} commentIds
 * @param {string} currentUserId
 * @returns {Promise<Map<string, {likedByCurrentUser: boolean}>>}
 */
async function fetchCommentLikesForComments(commentIds, currentUserId) {
  const likesByComment = new Map();
  if (commentIds.length === 0 || !currentUserId) return likesByComment;

  for (let i = 0; i < commentIds.length; i += 10) {
    const batch = commentIds.slice(i, i + 10);
    const q = query(
      collection(db, 'commentLikes'),
      where('commentId', 'in', batch)
    );
    const snap = await getDocs(q);
    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      if (!likesByComment.has(data.commentId)) {
        likesByComment.set(data.commentId, []);
      }
      likesByComment.get(data.commentId).push(data);
    }
  }

  const result = new Map();
  for (const [commentId, likes] of likesByComment) {
    result.set(commentId, {
      likedByCurrentUser: likes.some((like) => like.userId === currentUserId),
    });
  }

  return result;
}

/**
 * Fetch reply likes (likedByCurrentUser) for a batch of reply IDs.
 * @param {string[]} replyIds
 * @param {string} currentUserId
 * @returns {Promise<Map<string, {likedByCurrentUser: boolean}>>}
 */
async function fetchReplyLikesForReplies(replyIds, currentUserId) {
  const likesByReply = new Map();
  if (replyIds.length === 0 || !currentUserId) return likesByReply;

  for (let i = 0; i < replyIds.length; i += 10) {
    const batch = replyIds.slice(i, i + 10);
    const q = query(
      collection(db, 'replyLikes'),
      where('replyId', 'in', batch)
    );
    const snap = await getDocs(q);
    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      if (!likesByReply.has(data.replyId)) {
        likesByReply.set(data.replyId, []);
      }
      likesByReply.get(data.replyId).push(data);
    }
  }

  const result = new Map();
  for (const [replyId, likes] of likesByReply) {
    result.set(replyId, {
      likedByCurrentUser: likes.some((like) => like.userId === currentUserId),
    });
  }

  return result;
}

async function fetchCommentsForPosts(postIds, currentUserId) {
  const commentsByPost = new Map();
  if (postIds.length === 0) return commentsByPost;

  // Collect all comments across all post ID batches
  const allComments = [];

  // Firestore `in` is limited to 10 values per query
  for (let i = 0; i < postIds.length; i += 10) {
    const batch = postIds.slice(i, i + 10);
    const q = query(
      collection(db, 'comments'),
      where('postId', 'in', batch),
      orderBy('createdAt', 'asc')
    );
    const snap = await getDocs(q);
    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const authorProfile = await getUserSnapshot(data.userId);
      allComments.push({
        ..._normalizeFirestoreComment(docSnap, data.postId, authorProfile),
        _postId: data.postId,
      });
    }
  }

  if (allComments.length === 0) return commentsByPost;

  // Collect all comment IDs to fetch their replies
  const commentIds = allComments.map((c) => c.id);
  const repliesByCommentId = new Map();

  // Fetch replies in batches of 10
  for (let i = 0; i < commentIds.length; i += 10) {
    const batch = commentIds.slice(i, i + 10);
    const q = query(
      collection(db, 'replies'),
      where('commentId', 'in', batch),
      orderBy('createdAt', 'asc')
    );
    const snap = await getDocs(q);
    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const authorProfile = await getUserSnapshot(data.userId);
      if (!repliesByCommentId.has(data.commentId)) {
        repliesByCommentId.set(data.commentId, []);
      }
      repliesByCommentId.get(data.commentId).push(
        _normalizeFirestoreReply(docSnap, data.postId, data.commentId, authorProfile)
      );
    }
  }

  // Collect all reply IDs and fetch their likes
  const allReplyIds = [];
  for (const replies of repliesByCommentId.values()) {
    for (const reply of replies) {
      allReplyIds.push(reply.id);
    }
  }

  // Fetch likes for comments and replies
  const [commentLikes, replyLikes] = await Promise.all([
    fetchCommentLikesForComments(commentIds, currentUserId),
    fetchReplyLikesForReplies(allReplyIds, currentUserId),
  ]);

  // Attach replies and likes to comments, then group by postId
  for (const comment of allComments) {
    // Apply likedByCurrentUser to comment
    const commentLikeData = commentLikes.get(comment.id);
    if (commentLikeData) {
      comment.likes = {
        ...comment.likes,
        likedByCurrentUser: commentLikeData.likedByCurrentUser,
      };
    }

    const replies = repliesByCommentId.get(comment.id) || [];
    // Apply likedByCurrentUser to each reply
    for (const reply of replies) {
      const replyLikeData = replyLikes.get(reply.id);
      if (replyLikeData) {
        reply.likes = {
          ...reply.likes,
          likedByCurrentUser: replyLikeData.likedByCurrentUser,
        };
      }
    }
    comment.replies = replies;

    if (!commentsByPost.has(comment._postId)) {
      commentsByPost.set(comment._postId, []);
    }
    commentsByPost.get(comment._postId).push(comment);
    delete comment._postId;
  }

  // Done fetching comments
  return commentsByPost;
}

// ---------------------------------------------------------------------------
// Fetch remote posts with pagination
// ---------------------------------------------------------------------------

/**
 * Fetch remote posts with pagination.
 * Merges public posts + current user's private posts sorted newest-first.
 * @param {object} currentUser - Currently authenticated user
 * @param {object} options
 * @param {number} options.pageSize - Posts per page (default 10)
 * @param {object|null} options.lastDoc - Last document from previous page for pagination
 * @returns {Promise<{posts: Array, lastDoc: object|null, hasMore: boolean}>}
 */
export async function fetchRemotePosts({ currentUser, pageSize = 10, lastDoc = null }) {
  if (!currentUser) return { posts: [], lastDoc: null, hasMore: false };

  const uid = currentUser.id;
  let results = [];

  // 1. Fetch public posts
  let publicDocs = [];
  if (!lastDoc?.publicDone) {
    const publicConstraints = [
      where('visibility', '==', 'public'),
      orderBy('createdAt', 'desc'),
      limit(pageSize),
    ];
    if (lastDoc?.publicLastDoc) {
      publicConstraints.push(startAfter(lastDoc.publicLastDoc));
    }
    const publicQuery = query(collection(db, 'posts'), ...publicConstraints);
    publicDocs = (await getDocs(publicQuery)).docs;
  }

  // 2. Fetch current user's private posts
  let privateDocs = [];
  if (!lastDoc?.privateDone) {
    const privateConstraints = [
      where('userId', '==', uid),
      where('visibility', '==', 'private'),
      orderBy('createdAt', 'desc'),
      limit(pageSize),
    ];
    if (lastDoc?.privateLastDoc) {
      privateConstraints.push(startAfter(lastDoc.privateLastDoc));
    }
    const privateQuery = query(collection(db, 'posts'), ...privateConstraints);
    privateDocs = (await getDocs(privateQuery)).docs;
  }

  // 3. Merge results
  const postMap = new Map();

  for (const snap of [...publicDocs, ...privateDocs]) {
    if (!postMap.has(snap.id)) {
      const userId = snap.data().userId;
      const authorProfile = await getUserSnapshot(userId);
      const post = normalizeFirestorePost(snap, authorProfile);
      postMap.set(snap.id, post);
    }
  }

  // 3a. Fetch post likes, comments, and replies for all fetched posts
  const postIds = Array.from(postMap.keys());
  // Enrich with likes and comments
  const likesByPostId = await fetchPostLikesForPosts(postIds, uid);
  for (const [postId, likes] of likesByPostId) {
    const post = postMap.get(postId);
    if (post) {
      post.likes = {
        ...post.likes,
        ...likes,
      };
    }
  }

  const commentsByPostId = await fetchCommentsForPosts(postIds, uid);
  for (const [postId, comments] of commentsByPostId) {
    const post = postMap.get(postId);
    if (post) {
      post.comments = {
        previousCount: Math.max(0, comments.length - 1),
        items: comments,
      };
    }
  }

  // 4. Merge results
  results = Array.from(postMap.values());
  results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const publicDone = lastDoc?.publicDone || publicDocs.length < pageSize;
  const privateDone = lastDoc?.privateDone || privateDocs.length < pageSize;
  const hasMore = !publicDone || !privateDone;
  const newLastDoc = {
    publicLastDoc:
      publicDocs[publicDocs.length - 1] || lastDoc?.publicLastDoc || null,
    privateLastDoc:
      privateDocs[privateDocs.length - 1] || lastDoc?.privateLastDoc || null,
    publicDone,
    privateDone,
  };

  // Return posts with likes and comments enriched
  return { posts: results, lastDoc: newLastDoc, hasMore };
}

// ---------------------------------------------------------------------------
// Create remote post
// ---------------------------------------------------------------------------

export async function createRemotePost(post) {
  const postData = {
    localId: post.id,
    userId: post.author.id,
    text: post.title || '',
    imageUrl: post.imageUrl || null,
    imagePublicId: post.imagePublicId || null,
    visibility: post.visibility || 'public',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    likesCount: 0,
    commentsCount: 0,
    author: buildAuthorSnapshot(post.author),
  };

  const docRef = await addDoc(collection(db, 'posts'), postData);
  return { remoteId: docRef.id };
}

// ---------------------------------------------------------------------------
// Update remote post image (after Cloudinary upload)
// ---------------------------------------------------------------------------

export async function updateRemotePostImage({ remotePostId, imageUrl, imagePublicId }) {
  await updateDoc(doc(db, 'posts', remotePostId), {
    imageUrl: imageUrl || null,
    imagePublicId: imagePublicId || null,
    updatedAt: serverTimestamp(),
  });
}

// ---------------------------------------------------------------------------
// Add remote comment
// ---------------------------------------------------------------------------

export async function addRemoteComment({ postId, comment }) {
  // Use transaction to create comment and increment commentsCount
  const postRef = doc(db, 'posts', postId);
  const commentRef = await addDoc(collection(db, 'comments'), {
    localId: comment.id,
    postId,
    userId: comment.author.id,
    text: comment.text,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    likesCount: 0,
    repliesCount: 0,
    author: buildAuthorSnapshot(comment.author),
  });

  await updateDoc(postRef, {
    commentsCount: increment(1),
    updatedAt: serverTimestamp(),
  });

  return { remoteId: commentRef.id };
}

// ---------------------------------------------------------------------------
// Add remote reply
// ---------------------------------------------------------------------------

export async function addRemoteReply({ postId, commentId, reply }) {
  const commentRef = doc(db, 'comments', commentId);
  const replyRef = await addDoc(collection(db, 'replies'), {
    localId: reply.id,
    postId,
    commentId,
    userId: reply.author.id,
    text: reply.text,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    likesCount: 0,
    author: buildAuthorSnapshot(reply.author),
  });

  await updateDoc(commentRef, {
    repliesCount: increment(1),
    updatedAt: serverTimestamp(),
  });

  return { remoteId: replyRef.id };
}

// ---------------------------------------------------------------------------
// Post-like operations (scalable like collections + counter)
// ---------------------------------------------------------------------------

export async function toggleRemotePostLike({ postId, userId, liked }) {
  const likeDocId = `${postId}_${userId}`;

  if (liked) {
    // Add like
    await runTransaction(db, async (transaction) => {
      const postRef = doc(db, 'posts', postId);
      const likeRef = doc(db, 'postLikes', likeDocId);
      const postSnap = await transaction.get(postRef);
      const likeSnap = await transaction.get(likeRef);

      if (!postSnap.exists() || likeSnap.exists()) return;

      transaction.set(likeRef, {
        postId,
        userId,
        createdAt: serverTimestamp(),
      });
      transaction.update(postRef, {
        likesCount: increment(1),
        updatedAt: serverTimestamp(),
      });
    });
  } else {
    // Remove like
    await runTransaction(db, async (transaction) => {
      const postRef = doc(db, 'posts', postId);
      const likeRef = doc(db, 'postLikes', likeDocId);
      const postSnap = await transaction.get(postRef);
      const likeSnap = await transaction.get(likeRef);

      if (!postSnap.exists() || !likeSnap.exists()) return;

      transaction.delete(likeRef);
      transaction.update(postRef, {
        likesCount: increment(-1),
        updatedAt: serverTimestamp(),
      });
    });
  }
}

// ---------------------------------------------------------------------------
// Comment-like operations
// ---------------------------------------------------------------------------

export async function toggleRemoteCommentLike({ postId, commentId, userId, liked }) {
  const likeDocId = `${commentId}_${userId}`;

  if (liked) {
    await runTransaction(db, async (transaction) => {
      const commentRef = doc(db, 'comments', commentId);
      const likeRef = doc(db, 'commentLikes', likeDocId);
      const commentSnap = await transaction.get(commentRef);
      const likeSnap = await transaction.get(likeRef);

      if (!commentSnap.exists() || likeSnap.exists()) return;

      transaction.set(likeRef, {
        postId,
        commentId,
        userId,
        createdAt: serverTimestamp(),
      });
      transaction.update(commentRef, {
        likesCount: increment(1),
        updatedAt: serverTimestamp(),
      });
    });
  } else {
    await runTransaction(db, async (transaction) => {
      const commentRef = doc(db, 'comments', commentId);
      const likeRef = doc(db, 'commentLikes', likeDocId);
      const commentSnap = await transaction.get(commentRef);
      const likeSnap = await transaction.get(likeRef);

      if (!commentSnap.exists() || !likeSnap.exists()) return;

      transaction.delete(likeRef);
      transaction.update(commentRef, {
        likesCount: increment(-1),
        updatedAt: serverTimestamp(),
      });
    });
  }
}

// ---------------------------------------------------------------------------
// Reply-like operations
// ---------------------------------------------------------------------------

export async function toggleRemoteReplyLike({ postId, commentId, replyId, userId, liked }) {
  const likeDocId = `${replyId}_${userId}`;

  if (liked) {
    await runTransaction(db, async (transaction) => {
      const replyRef = doc(db, 'replies', replyId);
      const likeRef = doc(db, 'replyLikes', likeDocId);
      const replySnap = await transaction.get(replyRef);
      const likeSnap = await transaction.get(likeRef);

      if (!replySnap.exists() || likeSnap.exists()) return;

      transaction.set(likeRef, {
        postId,
        commentId,
        replyId,
        userId,
        createdAt: serverTimestamp(),
      });
      transaction.update(replyRef, {
        likesCount: increment(1),
        updatedAt: serverTimestamp(),
      });
    });
  } else {
    await runTransaction(db, async (transaction) => {
      const replyRef = doc(db, 'replies', replyId);
      const likeRef = doc(db, 'replyLikes', likeDocId);
      const replySnap = await transaction.get(replyRef);
      const likeSnap = await transaction.get(likeRef);

      if (!replySnap.exists() || !likeSnap.exists()) return;

      transaction.delete(likeRef);
      transaction.update(replyRef, {
        likesCount: increment(-1),
        updatedAt: serverTimestamp(),
      });
    });
  }
}

// ---------------------------------------------------------------------------
// Update post privacy
// ---------------------------------------------------------------------------

export async function updateRemotePostPrivacy({ postId, visibility }) {
  await updateDoc(doc(db, 'posts', postId), {
    visibility,
    updatedAt: serverTimestamp(),
  });
}

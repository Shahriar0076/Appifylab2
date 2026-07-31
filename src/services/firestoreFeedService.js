import {
  collection,
  doc,
  addDoc,
  documentId,
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
import { db } from '../config/firebaseFirestore';
import { formatRelativeTime } from '../utils/formatRelativeTime';

// ---------------------------------------------------------------------------
// User profile helpers for author snapshots
// ---------------------------------------------------------------------------

const userCache = new Map();

/**
 * Batch-fetch user profiles by document ID (Firestore `in` allows 10 values).
 * Returns a Map of uid → profile; misses (deleted users) are absent.
 * Entries already warm in userCache are returned without a network read.
 */
async function fetchUsersByIds(uids) {
  const uniqueIds = [...new Set(uids.filter(Boolean))];
  const missingIds = uniqueIds.filter((uid) => !userCache.has(uid));
  const usersById = new Map();

  if (missingIds.length > 0) {
    const batches = [];
    for (let i = 0; i < missingIds.length; i += 10) {
      batches.push(missingIds.slice(i, i + 10));
    }

    const snapshots = await Promise.all(
      batches.map((batch) =>
        getDocs(
          query(collection(db, 'users'), where(documentId(), 'in', batch))
        )
      )
    );

    for (const snap of snapshots.flatMap((snapshot) => snapshot.docs)) {
      const data = snap.data();
      if (!data) continue;

      const profile = {
        id: snap.id,
        name: `${data.firstName || ''} ${data.lastName || ''}`.trim(),
        initials: (data.firstName || '').charAt(0).toUpperCase(),
        avatarColor: data.avatarColor || '#1890FF',
        firstName: data.firstName || '',
        lastName: data.lastName || '',
      };
      userCache.set(snap.id, Promise.resolve(profile));
      usersById.set(snap.id, profile);
    }
  }

  for (const uid of uniqueIds) {
    if (!usersById.has(uid)) {
      const cached = await userCache.get(uid).catch(() => null);
      if (cached) usersById.set(uid, cached);
    }
  }

  return usersById;
}

async function getUserSnapshot(uid) {
  if (userCache.has(uid)) return userCache.get(uid);

  const profilePromise = getDoc(doc(db, 'users', uid))
    .then((snap) => {
      if (!snap.exists()) return null;

      const data = snap.data();
      return {
        id: uid,
        name: `${data.firstName} ${data.lastName}`,
        initials: (data.firstName || '').charAt(0).toUpperCase(),
        avatarColor: data.avatarColor || '#1890FF',
        firstName: data.firstName,
        lastName: data.lastName,
      };
    })
    .catch((error) => {
      userCache.delete(uid);
      throw error;
    });

  // Cache the in-flight request too, so concurrent post/comment normalization
  // does not issue duplicate reads for the same user.
  userCache.set(uid, profilePromise);
  return profilePromise;
}

function getAuthorSnapshot(data) {
  if (!data.author) return null;

  return {
    id: data.author.id || data.userId,
    name:
      data.author.name ||
      `${data.author.firstName || ''} ${data.author.lastName || ''}`.trim(),
    initials:
      data.author.initials ||
      (data.author.firstName || '').charAt(0).toUpperCase(),
    avatarColor: data.author.avatarColor || '#1890FF',
    firstName: data.author.firstName,
    lastName: data.author.lastName,
  };
}

async function resolveAuthor(data) {
  return getAuthorSnapshot(data) || getUserSnapshot(data.userId);
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
  const resolvedAuthor = authorProfile || getAuthorSnapshot(data);
  const createdAtISO = data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString();
  // Normalize the Firestore post doc into the UI shape
  return {
    id: docSnap.id,
    remoteId: docSnap.id,
    localId: data.localId || null,
    author: resolvedAuthor
      ? {
          id: resolvedAuthor.id,
          name: resolvedAuthor.name,
          initials: resolvedAuthor.initials,
          avatarColor: resolvedAuthor.avatarColor,
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
  const resolvedAuthor = authorProfile || getAuthorSnapshot(data);
  const createdAtISO = data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString();
  return {
    id: docSnap.id,
    remoteId: docSnap.id,
    localId: data.localId || null,
    postId: data.postId || postId,
    author: resolvedAuthor
      ? {
          id: resolvedAuthor.id,
          name: resolvedAuthor.name,
          initials: resolvedAuthor.initials,
          avatarColor: resolvedAuthor.avatarColor,
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
  const resolvedAuthor = authorProfile || getAuthorSnapshot(data);
  const createdAtISO = data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString();
  return {
    id: docSnap.id,
    remoteId: docSnap.id,
    localId: data.localId || null,
    postId: data.postId || postId,
    commentId: data.commentId || commentId,
    author: resolvedAuthor
      ? {
          id: resolvedAuthor.id,
          name: resolvedAuthor.name,
          initials: resolvedAuthor.initials,
          avatarColor: resolvedAuthor.avatarColor,
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

  const batches = [];
  for (let i = 0; i < postIds.length; i += 10) {
    batches.push(postIds.slice(i, i + 10));
  }

  const snapshots = await Promise.all(
    batches.map((batch) =>
      getDocs(
        query(collection(db, 'postLikes'), where('postId', 'in', batch))
      )
    )
  );

  for (const snap of snapshots) {
    for (const likeSnap of snap.docs) {
      const data = likeSnap.data();
      if (!likesByPost.has(data.postId)) likesByPost.set(data.postId, []);
      likesByPost.get(data.postId).push(data);
    }
  }

  // Batch-fetch preview user profiles once per page instead of one getDoc
  // per liker (Firestore `in` queries take batches of 10).
  const topLikersByPost = new Map();
  const previewUserIds = [];
  for (const [postId, likes] of likesByPost) {
    likes.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || 0;
      const bTime = b.createdAt?.toMillis?.() || 0;
      return bTime - aTime;
    });
    const topLikers = likes.slice(0, 6);
    topLikersByPost.set(postId, topLikers);
    for (const like of topLikers) previewUserIds.push(like.userId);
  }

  const usersById = await fetchUsersByIds(previewUserIds);

  for (const [postId, likes] of likesByPost) {
    const previewUsers = topLikersByPost
      .get(postId)
      .map((like) => usersById.get(like.userId))
      .filter(Boolean);

    likesByPost.set(postId, {
      previewUsers,
      likedByCurrentUser: likes.some(
        (like) => like.userId === currentUserId
      ),
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
        const topLikersByPost = new Map();
        const previewUserIds = [];
        for (const postId of batch) {
          const likes = rawLikesByPost.get(postId);
          likes.sort((a, b) => {
            const aTime = a.createdAt?.toMillis?.() || 0;
            const bTime = b.createdAt?.toMillis?.() || 0;
            return bTime - aTime;
          });
          const topLikers = likes.slice(0, 6);
          topLikersByPost.set(postId, topLikers);
          for (const like of topLikers) previewUserIds.push(like.userId);
        }

        const usersById = await fetchUsersByIds(previewUserIds);

        for (const postId of batch) {
          const likes = rawLikesByPost.get(postId);
          const previewUsers = topLikersByPost
            .get(postId)
            .map((like) => usersById.get(like.userId))
            .filter(Boolean);

          likesByPost.set(postId, {
            count: likes.length,
            previewUsers,
            likedByCurrentUser: likes.some(
              (like) => like.userId === currentUserId
            ),
          });
        }

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

  const batches = [];
  for (let i = 0; i < commentIds.length; i += 10) {
    batches.push(commentIds.slice(i, i + 10));
  }

  const snapshots = await Promise.all(
    batches.map((batch) =>
      getDocs(
        query(collection(db, 'commentLikes'), where('commentId', 'in', batch))
      )
    )
  );

  for (const snap of snapshots) {
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

  const batches = [];
  for (let i = 0; i < replyIds.length; i += 10) {
    batches.push(replyIds.slice(i, i + 10));
  }

  const snapshots = await Promise.all(
    batches.map((batch) =>
      getDocs(
        query(collection(db, 'replyLikes'), where('replyId', 'in', batch))
      )
    )
  );

  for (const snap of snapshots) {
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

  const postBatches = [];
  for (let i = 0; i < postIds.length; i += 10) {
    postBatches.push(postIds.slice(i, i + 10));
  }

  const commentSnapshots = await Promise.all(
    postBatches.map((batch) =>
      getDocs(
        query(
          collection(db, 'comments'),
          where('postId', 'in', batch),
          orderBy('createdAt', 'asc')
        )
      )
    )
  );
  const commentDocs = commentSnapshots.flatMap((snapshot) => snapshot.docs);
  const allComments = await Promise.all(
    commentDocs.map(async (docSnap) => {
      const data = docSnap.data();
      const authorProfile = await resolveAuthor(data);
      return {
        ..._normalizeFirestoreComment(docSnap, data.postId, authorProfile),
        _postId: data.postId,
      };
    })
  );

  if (allComments.length === 0) return commentsByPost;

  // Collect all comment IDs to fetch their replies
  const commentIds = allComments.map((c) => c.id);
  const repliesByCommentId = new Map();

  const commentBatches = [];
  for (let i = 0; i < commentIds.length; i += 10) {
    commentBatches.push(commentIds.slice(i, i + 10));
  }

  const replySnapshots = await Promise.all(
    commentBatches.map((batch) =>
      getDocs(
        query(
          collection(db, 'replies'),
          where('commentId', 'in', batch),
          orderBy('createdAt', 'asc')
        )
      )
    )
  );
  const replyDocs = replySnapshots.flatMap((snapshot) => snapshot.docs);
  const normalizedReplies = await Promise.all(
    replyDocs.map(async (docSnap) => {
      const data = docSnap.data();
      const authorProfile = await resolveAuthor(data);
      return {
        commentId: data.commentId,
        reply: _normalizeFirestoreReply(
          docSnap,
          data.postId,
          data.commentId,
          authorProfile
        ),
      };
    })
  );

  for (const { commentId, reply } of normalizedReplies) {
    if (!repliesByCommentId.has(commentId)) {
      repliesByCommentId.set(commentId, []);
    }
    repliesByCommentId.get(commentId).push(reply);
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

export async function fetchRemotePostComments({ posts, currentUser }) {
  if (!currentUser || posts.length === 0) return posts;

  const postMap = new Map(
    posts.map((post) => [post.remoteId || post.id, { ...post }])
  );
  const commentsByPostId = await fetchCommentsForPosts(
    [...postMap.keys()],
    currentUser.id
  );

  for (const [postId, comments] of commentsByPostId) {
    const post = postMap.get(postId);
    if (!post) continue;

    post.comments = {
      previousCount: Math.max(0, comments.length - 1),
      items: comments,
    };
  }

  return [...postMap.values()];
}

// ---------------------------------------------------------------------------
// Fetch remote posts with pagination
// ---------------------------------------------------------------------------

export const INITIAL_REMOTE_POST_PAGE_SIZE = 4;

const INITIAL_REMOTE_POST_CACHE_TTL_MS = 30_000;
const initialRemotePostRequests = new Map();

function getOrCreateInitialRemotePostRequest(currentUser) {
  if (!currentUser?.id) {
    return Promise.resolve({
      posts: [],
      lastDoc: null,
      hasMore: false,
      engagementLoaded: false,
    });
  }

  const uid = currentUser.id;
  const existingRequest = initialRemotePostRequests.get(uid);
  if (
    existingRequest &&
    Date.now() - existingRequest.startedAt < INITIAL_REMOTE_POST_CACHE_TTL_MS
  ) {
    return existingRequest.promise;
  }

  const request = {
    startedAt: Date.now(),
    promise: fetchRemotePosts({
      currentUser,
      pageSize: INITIAL_REMOTE_POST_PAGE_SIZE,
      includeEngagement: false,
    }),
  };

  initialRemotePostRequests.set(uid, request);

  // A failed preload must not prevent the feed from retrying normally.
  void request.promise.catch(() => {
    if (initialRemotePostRequests.get(uid) === request) {
      initialRemotePostRequests.delete(uid);
    }
  });

  setTimeout(() => {
    if (initialRemotePostRequests.get(uid) === request) {
      initialRemotePostRequests.delete(uid);
    }
  }, INITIAL_REMOTE_POST_CACHE_TTL_MS);

  return request.promise;
}

/**
 * Starts the first feed request as soon as authentication succeeds. The feed
 * consumes the same promise after navigation, avoiding a duplicate request.
 */
export function preloadInitialRemotePosts(userId) {
  return getOrCreateInitialRemotePostRequest({ id: userId });
}

export function fetchInitialRemotePosts({ currentUser }) {
  return getOrCreateInitialRemotePostRequest(currentUser);
}

/**
 * Fetch remote posts with pagination.
 * Merges public posts + current user's private posts sorted newest-first.
 * @param {object} currentUser - Currently authenticated user
 * @param {object} options
 * @param {number} options.pageSize - Posts per page (default 10)
 * @param {object|null} options.lastDoc - Last document from previous page for pagination
 * @returns {Promise<{posts: Array, lastDoc: object|null, hasMore: boolean}>}
 */
export async function fetchRemotePosts({
  currentUser,
  pageSize = 10,
  lastDoc = null,
  includeEngagement = true,
}) {
  if (!currentUser) return { posts: [], lastDoc: null, hasMore: false };

  const uid = currentUser.id;
  let results = [];

  const fetchPublicPosts = async () => {
    if (lastDoc?.publicDone) return [];

    const publicConstraints = [
      where('visibility', '==', 'public'),
      orderBy('createdAt', 'desc'),
      limit(pageSize),
    ];
    if (lastDoc?.publicLastDoc) {
      publicConstraints.push(startAfter(lastDoc.publicLastDoc));
    }
    const publicQuery = query(collection(db, 'posts'), ...publicConstraints);
    return (await getDocs(publicQuery)).docs;
  };

  const fetchPrivatePosts = async () => {
    if (lastDoc?.privateDone) return [];

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
    return (await getDocs(privateQuery)).docs;
  };

  const [publicDocs, privateDocs] = await Promise.all([
    fetchPublicPosts(),
    fetchPrivatePosts(),
  ]);

  // 3. Merge results
  const postMap = new Map();
  const uniquePostDocs = new Map(
    [...publicDocs, ...privateDocs].map((snap) => [snap.id, snap])
  );
  const normalizedPosts = await Promise.all(
    [...uniquePostDocs.values()].map(async (snap) => {
      const authorProfile = await resolveAuthor(snap.data());
      return normalizeFirestorePost(snap, authorProfile);
    })
  );
  for (const post of normalizedPosts) {
    postMap.set(post.id, post);
  }

  // 3a. Fetch post likes, comments, and replies for all fetched posts
  const postIds = Array.from(postMap.keys());
  if (includeEngagement) {
    const [likesByPostId, commentsByPostId] = await Promise.all([
      fetchPostLikesForPosts(postIds, uid),
      fetchCommentsForPosts(postIds, uid),
    ]);

    for (const [postId, likes] of likesByPostId) {
      const post = postMap.get(postId);
      if (post) {
        post.likes = {
          ...post.likes,
          ...likes,
        };
      }
    }

    for (const [postId, comments] of commentsByPostId) {
      const post = postMap.get(postId);
      if (post) {
        post.comments = {
          previousCount: Math.max(0, comments.length - 1),
          items: comments,
        };
      }
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
  return {
    posts: results,
    lastDoc: newLastDoc,
    hasMore,
    engagementLoaded: includeEngagement,
  };
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

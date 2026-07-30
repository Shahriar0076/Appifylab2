import { useState, useEffect, useCallback } from 'react';
import { clearAllImages } from '../utils/uploadImageStore';
import {
  backupCorrupted,
  safeReadArray,
  safeRemove,
  safeWriteJson,
} from '../utils/storage';
import { readQueue } from '../services/syncQueueService';
import {
  fetchInitialRemotePosts,
  fetchRemotePostComments,
  fetchRemotePosts,
  subscribeToPostLikes,
} from '../services/firestoreFeedService';
import { getRemotePostId } from '../utils/feedPostIdentity';
import { toast } from '../utils/toast';

const FEED_STORAGE_VERSION = 3;
const EMPTY_POSTS = [];

function getStorageKeys(userId) {
  const suffix = encodeURIComponent(userId);
  return {
    posts: `buddyScript.feed.posts.${suffix}`,
    version: `buddyScript.feed.version.${suffix}`,
  };
}

function sortNewestFirst(posts) {
  if (!Array.isArray(posts)) return [];

  return [...posts].sort((a, b) => {
    const aTime = Date.parse(a.createdAt) || 0;
    const bTime = Date.parse(b.createdAt) || 0;
    return bTime - aTime;
  });
}

function readStoredPosts(userId) {
  const keys = getStorageKeys(userId);
  // Version check: discard stored data if version is missing or old
  const storedVersion = localStorage.getItem(keys.version);
  if (storedVersion !== String(FEED_STORAGE_VERSION)) {
    if (localStorage.getItem(keys.posts) !== null) {
      backupCorrupted(keys.posts);
    }
    localStorage.removeItem(keys.posts);
    localStorage.removeItem(keys.version);
    return null;
  }

  const parsed = safeReadArray(keys.posts, null);
  if (parsed) return sortNewestFirst(parsed);
  if (localStorage.getItem(keys.posts) !== null) {
    backupCorrupted(keys.posts);
    console.warn('Corrupted cached feed data; loading posts from the server.');
  }
  return null;
}

function writeStoredPosts(userId, posts) {
  const keys = getStorageKeys(userId);
  const ok = safeWriteJson(keys.posts, sortNewestFirst(posts));
  if (ok) {
    try {
      localStorage.setItem(keys.version, String(FEED_STORAGE_VERSION));
    } catch {
      // Ignore version key write failure
    }
  }
  return ok;
}

function clearStoredPosts(userId) {
  const keys = getStorageKeys(userId);
  safeRemove(keys.posts);
  safeRemove(keys.version);
}

/**
 * Manages posts state: loading the current user's cache, persisting
 * changes, merging remote Firestore posts, and feed reset.
 */
export function useFeedData(userId) {
  const [postsState, setPostsState] = useState([]);
  const posts = Array.isArray(postsState) ? postsState : EMPTY_POSTS;
  const setPosts = useCallback((nextPosts) => {
    setPostsState((currentPosts) => {
      const safeCurrentPosts = Array.isArray(currentPosts) ? currentPosts : [];
      const resolvedPosts =
        typeof nextPosts === 'function'
          ? nextPosts(safeCurrentPosts)
          : nextPosts;

      if (!Array.isArray(resolvedPosts)) {
        console.error('Ignored an invalid feed state update; expected an array.');
        return safeCurrentPosts;
      }

      return resolvedPosts;
    });
  }, []);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingRemote, setIsFetchingRemote] = useState(false);
  const [hasLoadedFromStorage, setHasLoadedFromStorage] = useState(false);
  const [storageUserId, setStorageUserId] = useState(null);
  const [storageWarning, setStorageWarning] = useState('');
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMoreRemote, setHasMoreRemote] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const remotePostIdsKey = JSON.stringify(
    [...new Set(posts.map(getRemotePostId).filter(Boolean))].sort()
  );

  // Render cached posts immediately; the feed refreshes them in the background.
  useEffect(() => {
    let isMounted = true;

    function loadPosts() {
      if (!userId) return;

      const storedPosts = readStoredPosts(userId) || [];

      if (isMounted) {
        setPosts(storedPosts);
        setStorageUserId(userId);
        setHasLoadedFromStorage(true);
        setIsLoading(false);
      }
    }

    loadPosts();
    return () => {
      isMounted = false;
    };
  }, [userId, setPosts]);

  // ── Persist every state change to localStorage ──
  useEffect(() => {
    if (!hasLoadedFromStorage || storageUserId !== userId || isLoading) return;
    if (!userId) return;
    const ok = writeStoredPosts(userId, posts);
    if (!ok) {
      setStorageWarning('Changes may not persist after refresh (localStorage full).');
      toast.warning(
        'Storage nearly full — changes may not persist after refresh.'
      );
    }
  }, [hasLoadedFromStorage, isLoading, posts, storageUserId, userId]);


  /**
   * Check for a pending TOGGLE_POST_LIKE queue item. Returns queued value or null.
   */
  function getQueuedLikeValue(postId, userId) {
    const queue = readQueue();
    const toggles = queue.filter(
      (q) =>
        q.type === 'TOGGLE_POST_LIKE' &&
        q.payload?.postId === postId &&
        q.payload?.userId === userId &&
        (q.status === 'pending' || q.status === 'syncing' || q.status === 'failed')
    );
    if (toggles.length === 0) return null;
    // The last item in the queue is the most recent toggle for this post
    return toggles[toggles.length - 1].payload.liked;
  }

  // Keep like counts, preview users, and the signed-in user's like state live
  // for every remote post that has been loaded through pagination.
  useEffect(() => {
    if (!userId) return undefined;

    const postIds = JSON.parse(remotePostIdsKey);
    if (postIds.length === 0) return undefined;

    return subscribeToPostLikes({
      postIds,
      currentUserId: userId,
      onChange: (likesByPost) => {
        setPosts((currentPosts) =>
          currentPosts.map((post) => {
            const liveLikes = likesByPost.get(getRemotePostId(post));
            if (!liveLikes) return post;

            const queuedLiked = getQueuedLikeValue(post.id, userId);
            if (queuedLiked === null) {
              return { ...post, likes: liveLikes };
            }

            const liveLiked = liveLikes.likedByCurrentUser;
            const count = Math.max(
              0,
              liveLikes.count +
                (queuedLiked === liveLiked ? 0 : queuedLiked ? 1 : -1)
            );
            const currentUserPreview = post.likes?.previewUsers?.find(
              (user) => user.id === userId
            );
            const previewUsers = queuedLiked
              ? liveLikes.previewUsers.some((user) => user.id === userId) ||
                !currentUserPreview
                ? liveLikes.previewUsers
                : [currentUserPreview, ...liveLikes.previewUsers].slice(0, 6)
              : liveLikes.previewUsers.filter((user) => user.id !== userId);

            return {
              ...post,
              likes: {
                count,
                previewUsers,
                likedByCurrentUser: queuedLiked,
              },
            };
          })
        );
      },
      onError: (error) => {
        console.warn('Live post-like updates stopped:', error);
      },
    });
  }, [remotePostIdsKey, setPosts, userId]);

  /**
   * Check if there is a pending/syncing/failed TOGGLE_COMMENT_LIKE queue item.
   */
  function getQueuedCommentLikeValue(commentId, userId) {
    const queue = readQueue();
    const toggles = queue.filter(
      (q) =>
        q.type === 'TOGGLE_COMMENT_LIKE' &&
        q.payload?.commentId === commentId &&
        q.payload?.userId === userId &&
        (q.status === 'pending' || q.status === 'syncing' || q.status === 'failed')
    );
    if (toggles.length === 0) return null;
    return toggles[toggles.length - 1].payload.liked;
  }

  /**
   * Check if there is a pending/syncing/failed TOGGLE_REPLY_LIKE queue item.
   */
  function getQueuedReplyLikeValue(replyId, userId) {
    const queue = readQueue();
    const toggles = queue.filter(
      (q) =>
        q.type === 'TOGGLE_REPLY_LIKE' &&
        q.payload?.replyId === replyId &&
        q.payload?.userId === userId &&
        (q.status === 'pending' || q.status === 'syncing' || q.status === 'failed')
    );
    if (toggles.length === 0) return null;
    return toggles[toggles.length - 1].payload.liked;
  }

  /**
   * Merge remote comments with local.
   * Keeps pending local comments not yet in remote.
   * For matching comments, remote wins but preserves queued like toggles.
   */
  function mergeComments(localComments, remoteComments, currentUserId) {
    const localItems = localComments?.items || [];
    const remoteItems = remoteComments?.items || [];
    const remoteIds = new Set(remoteItems.map((c) => c.id));
    // Keep only local comments that haven't synced yet AND aren't already in remote
    const pendingLocal = localItems.filter(
      (c) =>
        (c.syncStatus === 'pending' || c.syncStatus === 'failed') &&
        !remoteIds.has(c.id)
    );

    // For remote comments that have a matching local comment, overlay any
    // queued (unsynced) like/reply-like state so the user's intent is reflected
    // even if the Firestore snapshot hasn't received the toggle yet.
    const mergedItems = remoteItems.map((remoteComment) => {
      if (!currentUserId) return remoteComment;

      const localComment = localItems.find((lc) => lc.id === remoteComment.id);
      if (!localComment) return remoteComment;

      let updated = remoteComment;

      // Check for a pending comment like toggle
      const queuedCommentLike = getQueuedCommentLikeValue(remoteComment.id, currentUserId);
      if (queuedCommentLike !== null) {
        updated = {
          ...updated,
          likes: {
            ...(updated.likes || {}),
            likedByCurrentUser: queuedCommentLike,
          },
        };
      }

      // Check for pending reply like toggles inside this comment
      const localReplies = localComment.replies || [];
      const remoteReplies = remoteComment.replies || [];
      if (localReplies.length > 0 && remoteReplies.length > 0) {
        let repliesUpdated = false;
        const mergedReplies = remoteReplies.map((remoteReply) => {
          const localReply = localReplies.find((lr) => lr.id === remoteReply.id);
          if (!localReply) return remoteReply;

          const queuedReplyLike = getQueuedReplyLikeValue(remoteReply.id, currentUserId);
          if (queuedReplyLike !== null) {
            repliesUpdated = true;
            return {
              ...remoteReply,
              likes: {
                ...(remoteReply.likes || {}),
                likedByCurrentUser: queuedReplyLike,
              },
            };
          }
          return remoteReply;
        });
        if (repliesUpdated) {
          updated = { ...updated, replies: mergedReplies };
        }
      }

      return updated;
    });

    return {
      previousCount: Math.max(0, mergedItems.length + pendingLocal.length - 1),
      items: [...mergedItems, ...pendingLocal],
    };
  }

  /**
   * Build a consistent likes object where likedByCurrentUser and previewUsers
   * agree. Firestore state is preferred; local queued state overrides only
   * when an unsynced TOGGLE_POST_LIKE exists.
   */
  function mergeLikes(remoteLikes, localLikes, currentUserId, currentUser) {
    const queuedValue = currentUserId
      ? getQueuedLikeValue(remoteLikes._postId, currentUserId)
      : null;

    const resolvedLiked = queuedValue ?? remoteLikes?.likedByCurrentUser ?? false;
    const previewUsers = remoteLikes?.previewUsers || [];

    return {
      count: remoteLikes?.count ?? 0,
      previewUsers: resolvedLiked
        ? previewUsers.some((u) => u.id === currentUserId)
          ? previewUsers
          : currentUser
            ? [currentUser, ...previewUsers.filter((u) => u.id !== currentUserId)].slice(0, 6)
            : previewUsers
        : previewUsers.filter((u) => u.id !== currentUserId),
      likedByCurrentUser: resolvedLiked,
    };
  }

  // ── Shared helper: merge remote posts result into current posts ──
  function mergeRemotePostsIntoState(currentPosts, result, remoteCurrentUser) {
    const merged = [...currentPosts];
    const existingLocalIds = new Set(merged.map((p) => p.localId || p.id));
    const hasRemoteEngagement = result.engagementLoaded !== false;

    for (const remotePost of result.posts) {
      const sameRemoteIdIndex = merged.findIndex(
        (post) => getRemotePostId(post) === remotePost.remoteId
      );
      if (sameRemoteIdIndex !== -1) {
        const currentPost = merged[sameRemoteIdIndex];
        merged[sameRemoteIdIndex] = {
          ...currentPost,
          ...remotePost,
          comments: hasRemoteEngagement
            ? mergeComments(
                currentPost.comments,
                remotePost.comments,
                remoteCurrentUser?.id
              )
            : currentPost.comments,
          likes: hasRemoteEngagement
            ? mergeLikes(
                { ...remotePost.likes, _postId: currentPost.id },
                currentPost.likes,
                remoteCurrentUser?.id,
                remoteCurrentUser
              )
            : currentPost.likes,
          localId: remotePost.localId || currentPost.localId || null,
        };
        continue;
      }

      if (remotePost.localId && existingLocalIds.has(remotePost.localId)) {
        const idx = merged.findIndex(
          (p) => (p.localId || p.id) === remotePost.localId
        );
        if (idx !== -1) {
          merged[idx] = {
            ...merged[idx],
            ...remotePost,
            comments: hasRemoteEngagement
              ? mergeComments(
                  merged[idx].comments,
                  remotePost.comments,
                  remoteCurrentUser?.id
                )
              : merged[idx].comments,
            likes: hasRemoteEngagement
              ? mergeLikes(
                  { ...remotePost.likes, _postId: remotePost.id },
                  merged[idx].likes,
                  remoteCurrentUser?.id,
                  remoteCurrentUser
                )
              : merged[idx].likes,
            localId: merged[idx].localId || merged[idx].id,
          };
        }
        continue;
      }

      merged.push(remotePost);
    }

    return sortNewestFirst(merged);
  }

  // ── Initial remote fetch (first page) ──
  const fetchAndMergeRemotePosts = useCallback(async (currentUser) => {
    if (!currentUser) return;
    setIsFetchingRemote(true);
    try {
      const result = await fetchInitialRemotePosts({ currentUser });
      if (result.posts.length === 0) {
        setHasMoreRemote(false);
        return;
      }

      setLastDoc(result.lastDoc);
      setHasMoreRemote(result.hasMore);

      setPosts((currentPosts) => {
        const merged = mergeRemotePostsIntoState(currentPosts, result, currentUser);
        return merged;
      });

      // Comments and replies are not part of the first-paint critical path.
      // Likes are filled by the live subscription once the posts are visible.
      void fetchRemotePostComments({
        posts: result.posts,
        currentUser,
      })
        .then((postsWithComments) => {
          const commentsByPostId = new Map(
            postsWithComments.map((post) => [
              getRemotePostId(post),
              post.comments,
            ])
          );
          setPosts((currentPosts) =>
            currentPosts.map((post) => {
              const remoteComments = commentsByPostId.get(
                getRemotePostId(post)
              );
              if (!remoteComments) return post;

              return {
                ...post,
                comments: mergeComments(
                  post.comments,
                  remoteComments,
                  currentUser.id
                ),
              };
            })
          );
        })
        .catch((error) => {
          console.warn('Failed to fetch post comments:', error);
        });
    } catch (err) {
      console.warn('Failed to fetch remote posts:', err);
      toast.warning('Could not fetch latest posts. Showing cached data.');
      setHasMoreRemote(false);
    } finally {
      setIsFetchingRemote(false);
    }
  }, [setPosts]);

  // ── Load next page of remote posts (triggered by scroll) ──
  const loadMoreRemotePosts = useCallback(async (currentUser) => {
    if (!currentUser || !hasMoreRemote || !lastDoc || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const result = await fetchRemotePosts({ currentUser, pageSize: 10, lastDoc });

      if (result.posts.length === 0) {
        setHasMoreRemote(false);
        return;
      }

      setLastDoc(result.lastDoc);
      setHasMoreRemote(result.hasMore);

      setPosts((currentPosts) =>
        mergeRemotePostsIntoState(currentPosts, result, currentUser)
      );
    } catch (err) {
      console.warn('Failed to load more remote posts:', err);
      toast.warning('Could not load more posts.');
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMoreRemote, lastDoc, isLoadingMore, setPosts]);

  // ── Wipe the current account's local feed cache ──
  const resetFeed = useCallback(() => {
    if (!userId) return;
    clearStoredPosts(userId);
    clearAllImages();
    setPosts([]);
    setLastDoc(null);
    setHasMoreRemote(false);
  }, [userId, setPosts]);

  return {
    posts,
    isLoading,
    isFetchingRemote,
    hasLoadedFromStorage,
    storageWarning,
    hasMoreRemote,
    isLoadingMore,
    setPosts,
    fetchAndMergeRemotePosts,
    loadMoreRemotePosts,
    resetFeed,
  };
}

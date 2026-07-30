import { useState, useEffect, useCallback } from 'react';
import { getPosts } from '../services/postService';
import { clearAllImages } from '../utils/uploadImageStore';
import { safeReadArray, safeWriteJson, safeRemove, backupCorrupted } from '../utils/storage';
import { normalizeSeedPosts } from '../utils/feedFactories';
import { readQueue } from '../services/syncQueueService';
import { fetchRemotePosts } from '../services/firestoreFeedService';
import { toast } from '../utils/toast';

const FEED_STORAGE_KEY = 'buddyScript.feed.posts';
const FEED_STORAGE_VERSION = 2;
const FEED_VERSION_KEY = 'buddyScript.feed.version';

function readStoredPosts() {
  // Version check: discard stored data if version is missing or old
  const storedVersion = localStorage.getItem(FEED_VERSION_KEY);
  if (storedVersion !== String(FEED_STORAGE_VERSION)) {
    if (localStorage.getItem(FEED_STORAGE_KEY) !== null) {
      backupCorrupted(FEED_STORAGE_KEY);
    }
    localStorage.removeItem(FEED_STORAGE_KEY);
    localStorage.removeItem(FEED_VERSION_KEY);
    return null;
  }

  const parsed = safeReadArray(FEED_STORAGE_KEY, null);
  if (parsed) return parsed;
  if (localStorage.getItem(FEED_STORAGE_KEY) !== null) {
    backupCorrupted(FEED_STORAGE_KEY);
    console.warn('Corrupted feed data in localStorage, falling back to seed.');
  }
  return null;
}

function writeStoredPosts(posts) {
  const ok = safeWriteJson(FEED_STORAGE_KEY, posts);
  if (ok) {
    try {
      localStorage.setItem(FEED_VERSION_KEY, String(FEED_STORAGE_VERSION));
    } catch {
      // Ignore version key write failure
    }
  }
  return ok;
}

function clearStoredPosts() {
  safeRemove(FEED_STORAGE_KEY);
  safeRemove(FEED_VERSION_KEY);
}

/**
 * Manages posts state: loading from localStorage or seed data, persisting
 * changes, merging remote Firestore posts, and feed reset.
 */
export function useFeedData() {
  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingRemote, setIsFetchingRemote] = useState(false);
  const [hasLoadedFromStorage, setHasLoadedFromStorage] = useState(false);
  const [storageWarning, setStorageWarning] = useState('');
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMoreRemote, setHasMoreRemote] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // ── Initial load: localStorage first, seed fallback ──
  useEffect(() => {
    let isMounted = true;

    async function loadPosts() {
      const storedPosts = readStoredPosts();

      if (storedPosts) {
        if (isMounted) {
          // Recover orphaned posts (pending but no matching queue item)
          const queue = readQueue();
          const queuePostIds = new Set(
            queue
              .filter((q) => q.status === 'pending' || q.status === 'syncing')
              .map((q) => q.payload?.localPostId || q.payload?.postId)
              .filter(Boolean)
          );
          const recovered = storedPosts.map((p) => {
            if (p.syncStatus === 'pending' && !queuePostIds.has(p.id)) {
              return {
                ...p,
                syncStatus: 'failed',
                syncError: 'Sync queue item lost — tap Retry to try again',
              };
            }
            return p;
          });
          setPosts(recovered);
          setHasLoadedFromStorage(true);
          setIsLoading(false);
        }
        return;
      }

      const seedPosts = await getPosts();
      const seeded = normalizeSeedPosts(seedPosts);
      if (isMounted) {
        const hadCorruptedData =
          localStorage.getItem(FEED_STORAGE_KEY) !== null;
        setPosts(seeded);
        setHasLoadedFromStorage(true);
        setIsLoading(false);
        if (hadCorruptedData) {
          toast.info('Local feed data was reset. Loading default feed...');
        }
      }
    }

    loadPosts();
    return () => {
      isMounted = false;
    };
  }, []);

  // ── Persist every state change to localStorage ──
  useEffect(() => {
    if (!hasLoadedFromStorage || isLoading) return;
    const ok = writeStoredPosts(posts);
    if (!ok) {
      setStorageWarning('Changes may not persist after refresh (localStorage full).');
      toast.warning(
        'Storage nearly full — changes may not persist after refresh.'
      );
    }
  }, [hasLoadedFromStorage, isLoading, posts]);


  /**
   * Check if there is a pending/failed TOGGLE_POST_LIKE queue item for this
   * post/user. When a like/unlike is queued but not yet synced, the local
   * queued value is the true intent; otherwise, the Firestore remote state
   * is authoritative.
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
   * Merge remote comments with local comments.
   * Remote comments are the source of truth for synced comments (from all users).
   * Local comments that are still pending/failed and not yet in the remote set
   * are preserved so the current user's unsynced contributions don't disappear.
   * When a remote comment matches a local comment (same id), the remote version
   * wins but local queued likes are preserved to avoid race conditions with
   * toggleCommentLike/toggleReplyLike that fired before the remote fetch completed.
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
            ? [currentUser, ...previewUsers.filter((u) => u.id !== currentUserId)].slice(0, 3)
            : previewUsers
        : previewUsers.filter((u) => u.id !== currentUserId),
      likedByCurrentUser: resolvedLiked,
    };
  }

  // ── Shared helper: merge remote posts result into current posts ──
  function mergeRemotePostsIntoState(currentPosts, result, remoteCurrentUser) {
    const merged = [...currentPosts];
    const existingLocalIds = new Set(merged.map((p) => p.localId || p.id));
    const existingRemoteIds = new Set(
      merged.map((p) => p.remoteId).filter(Boolean)
    );

    for (const remotePost of result.posts) {
      if (remotePost.remoteId && existingRemoteIds.has(remotePost.remoteId)) {
        const idx = merged.findIndex(
          (p) => p.remoteId === remotePost.remoteId
        );
        if (idx !== -1) {
          merged[idx] = {
            ...merged[idx],
            ...remotePost,
            comments: mergeComments(
              merged[idx].comments,
              remotePost.comments,
              remoteCurrentUser?.id
            ),
            likes: mergeLikes(
              { ...remotePost.likes, _postId: remotePost.id },
              merged[idx].likes,
              remoteCurrentUser?.id,
              remoteCurrentUser
            ),
            localId: merged[idx].localId || merged[idx].id,
          };
        }
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
            comments: mergeComments(
              merged[idx].comments,
              remotePost.comments,
              remoteCurrentUser?.id
            ),
            likes: mergeLikes(
              { ...remotePost.likes, _postId: remotePost.id },
              merged[idx].likes,
              remoteCurrentUser?.id,
              remoteCurrentUser
            ),
            localId: merged[idx].localId || merged[idx].id,
          };
        }
        continue;
      }

      merged.push(remotePost);
    }

    merged.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
    return merged;
  }

  // ── Initial remote fetch (first page) ──
  const fetchAndMergeRemotePosts = useCallback(async (currentUser) => {
    if (!currentUser) return;
    setIsFetchingRemote(true);
    try {
      const result = await fetchRemotePosts({ currentUser, pageSize: 5 });
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
      console.warn('Failed to fetch remote posts:', err);
      toast.warning('Could not fetch latest posts. Showing cached data.');
      setHasMoreRemote(false);
    } finally {
      setIsFetchingRemote(false);
    }
  }, []);

  // ── Load next page of remote posts (triggered by scroll) ──
  const loadMoreRemotePosts = useCallback(async (currentUser) => {
    if (!currentUser || !hasMoreRemote || !lastDoc || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const result = await fetchRemotePosts({ currentUser, pageSize: 5, lastDoc });

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
  }, [hasMoreRemote, lastDoc, isLoadingMore]);

  // ── Wipe local data and reload from seeds ──
  const resetFeed = useCallback(async () => {
    clearStoredPosts();
    clearAllImages();
    setIsLoading(true);
    const seedPosts = await getPosts();
    const seeded = normalizeSeedPosts(seedPosts);
    setPosts(seeded);
    setIsLoading(false);
  }, []);

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

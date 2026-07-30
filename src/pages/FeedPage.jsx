import { useCallback, useEffect, useRef, useState } from 'react';
import { Header } from '../components/feed/Header';
import { PostComposer } from '../components/feed/PostComposer';
import { FeedList } from '../components/feed/FeedList';
import { FeedSkeleton } from '../components/feed/FeedSkeleton';
import { LoadMoreSpinner } from '../components/feed/LoadMoreSpinner';
import { PageShell } from '../components/common/PageShell';
import { getCurrentUser } from '../services/userService';
import { getUiText } from '../services/uiTextService';
import { toast } from '../utils/toast';
import { useFeed } from '../context/FeedContext';
import { useAuth } from '../context/AuthContext';

const POSTS_PER_PAGE = 5;

export function FeedPage() {
  const [uiText, setUiText] = useState({});
  const [visiblePostCount, setVisiblePostCount] = useState(POSTS_PER_PAGE);
  const [currentUser, setCurrentUser] = useState(null);
  const loadMoreRef = useRef(null);
  const {
    posts,
    isLoading,
    syncStatusMessage,
    isOnline,
    storageWarning,
    hasMoreRemote,
    isLoadingMore,
    createPost,
    togglePostLike,
    addComment,
    addReply,
    toggleCommentLike,
    toggleReplyLike,
    updatePostPrivacy,
    fetchAndMergeRemotePosts,
    loadMoreRemotePosts,
    retrySyncItem,
  } = useFeed();
  const { currentUser: authUser } = useAuth();

  useEffect(() => {
    if (authUser) {
      setCurrentUser(authUser);
    } else {
      getCurrentUser().then(setCurrentUser);
    }
  }, [authUser]);

  useEffect(() => {
    getUiText().then(setUiText);
  }, []);

  useEffect(() => {
    if (authUser && currentUser) {
      fetchAndMergeRemotePosts(authUser || currentUser);
    }
  }, [authUser, currentUser, fetchAndMergeRemotePosts]);

  useEffect(() => {
    setVisiblePostCount((count) =>
      Math.max(POSTS_PER_PAGE, Math.min(count, posts.length || POSTS_PER_PAGE))
    );
  }, [posts.length]);

  const visiblePosts = posts.slice(0, visiblePostCount);
  const hasMorePosts = visiblePostCount < posts.length;

  // Reveal more local posts when sentinel is visible (200px offset)
  useEffect(() => {
    const loadMoreNode = loadMoreRef.current;
    if (!loadMoreNode || !hasMorePosts) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisiblePostCount((count) => Math.min(count + POSTS_PER_PAGE, posts.length));
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(loadMoreNode);

    return () => observer.disconnect();
  }, [hasMorePosts, posts.length]);

  // Auto-load next remote page when local posts are exhausted
  useEffect(() => {
    if (!hasMorePosts && hasMoreRemote && currentUser && !isLoadingMore) {
      loadMoreRemotePosts(currentUser);
    }
  }, [hasMorePosts, hasMoreRemote, isLoadingMore, currentUser, loadMoreRemotePosts]);

  const handlePost = useCallback(
    async ({ content, privacy, imageBlob }) => {
      const result = await createPost({ content, privacy, imageBlob, currentUser });
      if (!result.ok) {
        console.error('Post creation failed:', result.error);
        toast.error(result.error);
      }
    },
    [createPost, currentUser]
  );

  const handleLikePost = useCallback(
    (postId) => {
      togglePostLike(postId, currentUser);
    },
    [togglePostLike, currentUser]
  );

  const handleAddComment = useCallback(
    (postId, text) => {
      addComment(postId, text, currentUser);
    },
    [addComment, currentUser]
  );

  const handleAddReply = useCallback(
    (postId, commentId, text) => {
      addReply(postId, commentId, text, currentUser);
    },
    [addReply, currentUser]
  );

  const handleLikeComment = useCallback(
    (postId, commentId) => {
      toggleCommentLike(postId, commentId, currentUser);
    },
    [toggleCommentLike, currentUser]
  );

  const handleLikeReply = useCallback(
    (postId, commentId, replyId) => {
      toggleReplyLike(postId, commentId, replyId, currentUser);
    },
    [toggleReplyLike, currentUser]
  );

  // ── Auth still loading: show a full-page branded loader ──
  if (!currentUser) {
    return (
      <PageShell>
        <div className="_layout _main_layout _feed_skeleton_init_wrap">
          <div className="_feed_skeleton_init_loader">
            <div className="_feed_skeleton_init_spinner" />
            <p className="_feed_skeleton_init_text">Buddy Script</p>
          </div>
        </div>
      </PageShell>
    );
  }

  // ── User ready, initial posts loading: show skeleton cards ──
  // Show skeleton only on initial load to avoid flickering cached content
  if (isLoading) {
    return (
      <PageShell>
        <div className="_layout">
          <div className="_main_layout">
            <Header currentUser={currentUser} />
            <div className="container _custom_container">
              <div className="_layout_inner_wrap">
                <div className="row">
                  <div className="col-xl-12 col-lg-12 col-md-12 col-sm-12">
                    <div className="_layout_middle_wrap">
                      <div className="_layout_middle_inner">
                        <FeedSkeleton count={3} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="_layout">
        <div className="_main_layout">
          <Header currentUser={currentUser} />
          <div className="container _custom_container">
            <div className="_layout_inner_wrap">
              <div className="row">
                <div className="col-xl-12 col-lg-12 col-md-12 col-sm-12">
                  <div className="_layout_middle_wrap">
                    <div className="_layout_middle_inner">
                      {!isOnline && (
                        <div className="_feed_sync_status _feed_sync_status_warning">
                          Offline — changes will sync when you&apos;re back online
                        </div>
                      )}
                      {storageWarning && (
                        <div className="_feed_sync_status _feed_sync_status_warning">
                          {storageWarning}
                        </div>
                      )}
                      {syncStatusMessage && (
                        <div className={'_feed_sync_status ' + (syncStatusMessage.includes('Failed') || syncStatusMessage.includes('failed') ? '_feed_sync_status_error' : syncStatusMessage.includes('Uploading') || syncStatusMessage.includes('Saving') ? '_feed_sync_status_info' : '_feed_sync_status_success')}>
                          {syncStatusMessage}
                        </div>
                      )}
                      <PostComposer
                        currentUser={currentUser}
                        uiText={uiText?.feed || {}}
                        onPost={handlePost}
                      />
                      <FeedList
                        posts={visiblePosts}
                        currentUser={currentUser}
                        uiText={uiText?.feed || {}}
                        onLikePost={handleLikePost}
                        onAddComment={handleAddComment}
                        onAddReply={handleAddReply}
                        onLikeComment={handleLikeComment}
                        onLikeReply={handleLikeReply}
                        onUpdatePrivacy={(postId, visibility) =>
                          updatePostPrivacy(postId, visibility, currentUser)
                        }
                        onRetrySync={retrySyncItem}
                      />
                      {hasMorePosts && (
                        <div
                          ref={loadMoreRef}
                          aria-hidden="true"
                          style={{ minHeight: '1px' }}
                        />
                      )}
                      <LoadMoreSpinner isLoadingMore={isLoadingMore} hasMore={hasMorePosts || hasMoreRemote} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

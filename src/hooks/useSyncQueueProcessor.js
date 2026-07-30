import { useEffect, useRef, useState } from 'react';
import { toast } from '../utils/toast';
import {
  getPendingItems,
  markSyncing,
  markSynced,
  markFailed,
  getBackoffDelay,
} from '../services/syncQueueService';
import {
  createRemotePost,
  updateRemotePostImage,
  addRemoteComment,
  addRemoteReply,
  toggleRemotePostLike,
  toggleRemoteCommentLike,
  toggleRemoteReplyLike,
  updateRemotePostPrivacy,
} from '../services/firestoreFeedService';
import { uploadPostImage } from '../services/cloudinaryService';
import { getImage } from '../utils/uploadImageStore';
import { getRemotePostId } from '../utils/feedPostIdentity';

const ACTION_LABELS = {
  CREATE_POST: { saving: 'Saving post...', done: 'Posted' },
  UPDATE_POST_IMAGE: { saving: 'Saving image...', done: 'Updated' },
  ADD_COMMENT: { saving: 'Saving comment...', done: 'Replied' },
  ADD_REPLY: { saving: 'Saving reply...', done: 'Replied' },
  TOGGLE_POST_LIKE: { saving: 'Saving like...', done: 'Liked' },
  TOGGLE_COMMENT_LIKE: { saving: 'Saving like...', done: 'Liked' },
  TOGGLE_REPLY_LIKE: { saving: 'Saving like...', done: 'Liked' },
  UPDATE_POST_PRIVACY: { saving: 'Saving privacy...', done: 'Updated' },
};

/**
 * Race a promise against a timeout.
 */
function withTimeout(promise, ms, errorMessage) {
  let timerId = null;
  const timeout = new Promise((_, reject) => {
    timerId = setTimeout(() => reject(new Error(errorMessage || `Operation timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timerId) clearTimeout(timerId);
  });
}

export function useSyncQueueProcessor({ isOnline, setSyncStatusMessage, setPosts, posts }) {
  const processingRef = useRef(false);
  const [wakeSignal, setWakeSignal] = useState(0);
  // Keep a ref so async callbacks always read the latest posts
  const postsRef = useRef(posts);
  postsRef.current = posts;

  // Wake up whenever new items are enqueued
  useEffect(() => {
    const handleQueueChange = () => {
      setWakeSignal((prev) => prev + 1);
    };
    window.addEventListener('sync-queue-changed', handleQueueChange);
    return () => window.removeEventListener('sync-queue-changed', handleQueueChange);
  }, []);

  useEffect(() => {
    if (!isOnline || processingRef.current) return;

    const pendingItems = getPendingItems();
    if (pendingItems.length === 0) return;

    processingRef.current = true;

    const processNext = async () => {
      const items = getPendingItems();
      if (items.length === 0) {
        processingRef.current = false;
        setSyncStatusMessage('');
        toast.dismiss('saving-toast');
        return;
      }

      const item = items[0];
      const labels = ACTION_LABELS[item.type] || { saving: 'Saving...', done: 'Saved' };

      toast.info(labels.saving, {
        autoClose: false,
        closeButton: false,
        draggable: false,
        toastId: 'saving-toast',
      });

      try {
        markSyncing(item.id);

        switch (item.type) {
          case 'CREATE_POST': {
            const { localPostId, hasImage: _hasImage } = item.payload;

            const currentPost = postsRef.current.find((post) => post.id === localPostId);

            if (getRemotePostId(currentPost)) {
              markSynced(item.id);
              break;
            }

            if (!currentPost) {
              markSynced(item.id);
              break;
            }

            let imageUrl = null;
            let imagePublicId = null;

            if (_hasImage && currentPost.image?.startsWith('/uploads/')) {
              setSyncStatusMessage('Uploading image...');
              try {
                const blob = await withTimeout(getImage(currentPost.image), 15000, 'Reading image from local storage timed out.');
                if (blob) {
                  const uploadResult = await uploadPostImage(blob, { postId: localPostId });
                  imageUrl = uploadResult.url;
                  imagePublicId = uploadResult.publicId;
                }
              } catch (imgErr) {
                setPosts((prev) =>
                  prev.map((p) =>
                    p.id === localPostId
                      ? { ...p, syncStatus: 'failed', imageUploadStatus: 'failed', syncError: imgErr.message }
                      : p
                  )
                );
                markFailed(item.id, imgErr.message);
                toast.dismiss('saving-toast');
                setSyncStatusMessage('Image upload failed · Retry');
                processingRef.current = false;
                return;
              }
            }

            const postPayload = {
              id: localPostId,
              author: currentPost.author,
              title: currentPost.title,
              visibility: currentPost.visibility,
              imageUrl,
              imagePublicId,
            };

            const { remoteId } = await withTimeout(
              createRemotePost(postPayload),
              30000,
              'Post creation timed out. The server may be temporarily unreachable.'
            );

            setPosts((prev) =>
              prev.map((p) =>
                p.id === localPostId
                  ? {
                      ...p,
                      remoteId,
                      syncStatus: 'synced',
                      syncError: null,
                      imageUploadStatus: imageUrl ? 'synced' : 'none',
                      imageRemoteUrl: imageUrl,
                      imagePublicId,
                    }
                  : p
              )
            );

            markSynced(item.id);
            break;
          }

          case 'UPDATE_POST_IMAGE': {
            const { localPostId, remotePostId } = item.payload;

            setSyncStatusMessage('Uploading image...');
            const imgPost = postsRef.current.find((p) => p.id === localPostId);

            if (!imgPost?.image?.startsWith('/uploads/')) {
              markSynced(item.id);
              break;
            }

            try {
              const blob = await withTimeout(getImage(imgPost.image), 15000, 'Reading image from local storage timed out.');
              if (blob) {
                const uploadResult = await uploadPostImage(blob, { postId: localPostId });
                await withTimeout(
                  updateRemotePostImage({
                    remotePostId,
                    imageUrl: uploadResult.url,
                    imagePublicId: uploadResult.publicId,
                  }),
                  30000,
                  'Image update timed out.'
                );

                setPosts((prev) =>
                  prev.map((p) =>
                    p.id === localPostId
                      ? {
                          ...p,
                          imageUploadStatus: 'synced',
                          imageRemoteUrl: uploadResult.url,
                          imagePublicId: uploadResult.publicId,
                        }
                      : p
                  )
                );
              }
            } catch (imgErr) {
              setPosts((prev) =>
                prev.map((p) =>
                  p.id === localPostId
                    ? { ...p, syncStatus: 'failed', imageUploadStatus: 'failed', syncError: imgErr.message }
                    : p
                )
              );
              markFailed(item.id, imgErr.message);
              setSyncStatusMessage('Image upload failed · Retry');
              processingRef.current = false;
              return;
            }

            markSynced(item.id);
            break;
          }

          case 'ADD_COMMENT': {
            const { postId, comment } = item.payload;

            // Find the remote post ID — delay sync if post hasn't synced yet
            const commentHostPost = postsRef.current.find((p) => p.id === postId);
            const commentRemotePostId = getRemotePostId(commentHostPost);

            if (!commentRemotePostId) {
              // Parent post not synced — retry on next pass
              markFailed(item.id, 'Parent post not yet synced.');
              break;
            }

            const { remoteId: commentRemoteId } = await withTimeout(
              addRemoteComment({
                postId: commentRemotePostId,
                comment,
              }),
              30000,
              'Comment sync timed out.'
            );

            setPosts((prev) =>
              prev.map((p) => {
                if (p.id !== postId) return p;
                return {
                  ...p,
                  comments: {
                    ...(p.comments || { previousCount: 0, items: [] }),
                    items: (p.comments?.items || []).map((c) =>
                      c.id === comment.id ? { ...c, remoteId: commentRemoteId, syncStatus: 'synced', syncError: null } : c
                    ),
                  },
                };
              })
            );

            markSynced(item.id);
            break;
          }

          case 'ADD_REPLY': {
            const { postId, commentId, reply } = item.payload;

            const replyHostPost = postsRef.current.find((p) => p.id === postId);
            const replyRemotePostId = getRemotePostId(replyHostPost);
            const replyHostComment = replyHostPost?.comments?.items?.find((c) => c.id === commentId);
            const replyRemoteCommentId = replyHostComment?.remoteId || null;

            if (!replyRemotePostId || !replyRemoteCommentId) {
              // Parent post or comment hasn't synced yet; retry later
              markFailed(item.id, 'Parent post or comment not yet synced.');
              break;
            }

            const { remoteId: replyRemoteId } = await withTimeout(
              addRemoteReply({
                postId: replyRemotePostId,
                commentId: replyRemoteCommentId,
                reply,
              }),
              30000,
              'Reply sync timed out.'
            );

            setPosts((prev) =>
              prev.map((p) => {
                if (p.id !== postId) return p;
                return {
                  ...p,
                  comments: {
                    ...(p.comments || { previousCount: 0, items: [] }),
                    items: (p.comments?.items || []).map((c) =>
                      c.id === commentId
                        ? {
                            ...c,
                            replies: (c.replies || []).map((r) =>
                              r.id === reply.id
                                ? { ...r, remoteId: replyRemoteId, syncStatus: 'synced', syncError: null }
                                : r
                            ),
                          }
                        : c
                    ),
                  },
                };
              })
            );

            markSynced(item.id);
            break;
          }

          case 'TOGGLE_POST_LIKE': {
            const { postId, userId, liked } = item.payload;

            const togglePost = postsRef.current.find((p) => p.id === postId);
            const togglePostRemoteId = getRemotePostId(togglePost);

            if (togglePostRemoteId) {
              await withTimeout(
                toggleRemotePostLike({ postId: togglePostRemoteId, userId, liked }),
                30000,
                'Like sync timed out.'
              );
            }
            markSynced(item.id);
            break;
          }

          case 'TOGGLE_COMMENT_LIKE': {
            const { postId, commentId, userId, liked } = item.payload;

            const toggleCommentPost = postsRef.current.find((p) => p.id === postId);
            const toggleCommentRemotePostId = getRemotePostId(toggleCommentPost);
            const toggleComment = toggleCommentPost?.comments?.items?.find((c) => c.id === commentId);
            const toggleCommentRemoteCommentId = toggleComment?.remoteId || null;

            if (toggleCommentRemotePostId && toggleCommentRemoteCommentId) {
              await withTimeout(
                toggleRemoteCommentLike({
                  postId: toggleCommentRemotePostId,
                  commentId: toggleCommentRemoteCommentId,
                  userId,
                  liked,
                }),
                30000,
                'Comment like sync timed out.'
              );
            }
            markSynced(item.id);
            break;
          }

          case 'TOGGLE_REPLY_LIKE': {
            const { postId, commentId, replyId, userId, liked } = item.payload;

            const toggleReplyPost = postsRef.current.find((p) => p.id === postId);
            const toggleReplyRemotePostId = getRemotePostId(toggleReplyPost);
            const toggleReplyComment = toggleReplyPost?.comments?.items?.find((c) => c.id === commentId);
            const toggleReplyRemoteCommentId = toggleReplyComment?.remoteId || null;
            const toggleReply = toggleReplyComment?.replies?.find((r) => r.id === replyId);
            const toggleReplyRemoteReplyId = toggleReply?.remoteId || null;

            if (toggleReplyRemotePostId && toggleReplyRemoteCommentId && toggleReplyRemoteReplyId) {
              await withTimeout(
                toggleRemoteReplyLike({
                  postId: toggleReplyRemotePostId,
                  commentId: toggleReplyRemoteCommentId,
                  replyId: toggleReplyRemoteReplyId,
                  userId,
                liked,
                }),
                30000,
                'Reply like sync timed out.'
              );
            }
            markSynced(item.id);
            break;
          }

          case 'UPDATE_POST_PRIVACY': {
            const { postId, visibility } = item.payload;

            const privacyPost = postsRef.current.find((p) => p.id === postId);
            const privacyRemotePostId = getRemotePostId(privacyPost);

            if (privacyRemotePostId) {
              await withTimeout(
                updateRemotePostPrivacy({
                  postId: privacyRemotePostId,
                  visibility,
                }),
                30000,
                'Privacy update timed out.'
              );
              markSynced(item.id);
            } else {
              // Post not yet synced — privacy will sync with CREATE_POST
              markSynced(item.id);
            }
            break;
          }

          default:
            markSynced(item.id);
            break;
        }

        setSyncStatusMessage('');
        toast.dismiss('saving-toast');
        toast.success(labels.done);
      } catch (err) {
        const currentAttempts = (item.attempts || 0) + 1;
        console.error('Sync queue processor error:', item.type, err.message);
        markFailed(item.id, err.message);
        toast.dismiss('saving-toast');
        setSyncStatusMessage('Failed to sync · Retry');

        // Mark post sync failed in local state
        const affectedPostId = item.payload?.localPostId || item.payload?.postId;
        if (affectedPostId) {
          setPosts((prev) =>
            prev.map((p) =>
              p.id === affectedPostId
                ? { ...p, syncStatus: 'failed', syncError: err.message }
                : p
            )
          );
        }

        // Stop retrying after max attempts
        if (currentAttempts >= 5) {
          toast.dismiss('saving-toast');
          setSyncStatusMessage('Sync failed after multiple attempts. Tap Retry on the post to try again.');
          processingRef.current = false;
          return;
        }

        const backoffDelay = getBackoffDelay(currentAttempts - 1);
        setTimeout(processNext, backoffDelay);
        return;
      }

      setTimeout(processNext, 500);
    };

    processNext();

    return () => {
      processingRef.current = false;
    };
  }, [isOnline, setSyncStatusMessage, setPosts, wakeSignal]);
}

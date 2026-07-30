import { useCallback, useMemo } from 'react';
import { saveImage, generateImagePath } from '../utils/uploadImageStore';
import { enqueue, readQueue, writeQueue } from '../services/syncQueueService';
import { validatePost, validateComment } from '../utils/feedValidation';
import { toast } from '../utils/toast';
import {
  createId,
  normalizeUser,
  createLocalPost,
  createLocalComment,
  createLocalReply,
} from '../utils/feedFactories';
import {
  togglePostLike as mutateTogglePostLike,
  toggleCommentLike as mutateToggleCommentLike,
  toggleReplyLike as mutateToggleReplyLike,
  updatePostPrivacy as mutateUpdatePostPrivacy,
  appendComment,
  appendReply,
} from '../utils/feedMutations';

/**
 * All feed mutation actions that operate on the posts state.
 * Each action performs an optimistic update via setPosts then enqueues
 * the operation for background sync.
 *
 * @param {Function} setPosts - React state setter from useState (stable)
 * @param {Array} posts - Current posts state — used to read the latest state
 *                         before any deferred setPosts updater (React 19+).
 * @returns {object} stable set of action methods
 */
export function useFeedActions(setPosts, posts) {
  const createPost = useCallback(
    async ({ content, privacy, imageBlob, currentUser }) => {
      if (!currentUser) return { ok: false, error: 'You must be logged in.' };

      const validation = validatePost({ content, privacy, imageBlob });
      if (!validation.valid) {
        toast.error(validation.error);
        return validation;
      }

      const postId = createId('post');
      let imagePath = null;
      const hasText = content?.trim();
      if (imageBlob) {
        imagePath = generateImagePath(postId);
        try {
          await saveImage(imagePath, imageBlob);
        } catch {
          imagePath = null;
          if (!hasText) {
            const errMsg = 'Failed to save image. Please try a smaller image or try again.';
            toast.error(errMsg);
            return {
              ok: false,
              error: errMsg,
            };
          }
        }
      }

      const newPost = createLocalPost({
        id: postId,
        author: normalizeUser(currentUser),
        content,
        privacy,
        imagePath,
      });

      setPosts((currentPosts) => [newPost, ...currentPosts]);

      const { ok: enqueueOk } = enqueue('CREATE_POST', {
        localPostId: postId,
        hasImage: !!imagePath,
      });

      if (!enqueueOk) {
        toast.warning('Local storage is full — your post may not be saved if you refresh.');
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? {
                  ...p,
                  syncStatus: 'failed',
                  syncError: 'localStorage full — changes may not persist',
                }
              : p
          )
        );
      }

      return { ok: true, localId: postId, enqueued: enqueueOk };
    },
    [setPosts]
  );

  const togglePostLike = useCallback(
    (postId, currentUser) => {
      if (!currentUser) return;

      const post = posts.find((p) => p.id === postId);
      const prevLiked = post?.likes?.likedByCurrentUser || false;

      setPosts((currentPosts) => {
        return mutateTogglePostLike(currentPosts, postId, currentUser);
      });

      const { ok: toggleEnqueueOk } = enqueue('TOGGLE_POST_LIKE', {
        postId,
        userId: currentUser.id,
        liked: !prevLiked,
      });

      if (!toggleEnqueueOk) {
        toast.warning('Local storage is full — your like may not persist.');
      }
    },
    [setPosts, posts]
  );

  const addComment = useCallback(
    (postId, text, currentUser) => {
      if (!currentUser || !text?.trim())
        return { ok: false, error: 'Comment cannot be empty.' };

      const validation = validateComment(text);
      if (!validation.valid) {
        toast.error(validation.error);
        return validation;
      }

      const commentId = createId('comment');
      const newComment = createLocalComment({
        id: commentId,
        author: normalizeUser(currentUser),
        text,
      });

      setPosts((currentPosts) => appendComment(currentPosts, postId, newComment));

      const { ok: enqueueOk } = enqueue('ADD_COMMENT', {
        postId,
        comment: {
          id: commentId,
          author: newComment.author,
          text,
        },
      });

      if (!enqueueOk) {
        toast.warning('Local storage is full — your comment may not persist.');
        setPosts((prev) =>
          prev.map((p) =>
            p.id !== postId
              ? p
              : {
                  ...p,
                  comments: {
                    ...(p.comments || { previousCount: 0, items: [] }),
                    items: (p.comments?.items || []).map((c) =>
                      c.id === commentId
                        ? {
                            ...c,
                            syncStatus: 'failed',
                            syncError: 'localStorage full — changes may not persist',
                          }
                        : c
                    ),
                  },
                }
          )
        );
      }

      return { ok: true };
    },
    [setPosts]
  );

  const addReply = useCallback(
    (postId, commentId, text, currentUser) => {
      if (!currentUser || !text?.trim())
        return { ok: false, error: 'Reply cannot be empty.' };

      const validation = validateComment(text);
      if (!validation.valid) {
        toast.error(validation.error);
        return validation;
      }

      const replyId = createId('reply');
      const newReply = createLocalReply({
        id: replyId,
        author: normalizeUser(currentUser),
        text,
      });

      setPosts((currentPosts) =>
        appendReply(currentPosts, postId, commentId, newReply)
      );

      const { ok: enqueueOk } = enqueue('ADD_REPLY', {
        postId,
        commentId,
        reply: {
          id: replyId,
          author: newReply.author,
          text,
        },
      });

      if (!enqueueOk) {
        toast.warning('Local storage is full — your reply may not persist.');
        setPosts((prev) =>
          prev.map((p) =>
            p.id !== postId
              ? p
              : {
                  ...p,
                  comments: {
                    ...(p.comments || { previousCount: 0, items: [] }),
                    items: (p.comments?.items || []).map((c) =>
                      c.id !== commentId
                        ? c
                        : {
                            ...c,
                            replies: (c.replies || []).map((r) =>
                              r.id === replyId
                                ? {
                                    ...r,
                                    syncStatus: 'failed',
                                    syncError:
                                      'localStorage full — changes may not persist',
                                  }
                                : r
                            ),
                          }
                    ),
                  },
                }
          )
        );
      }

      return { ok: true };
    },
    [setPosts]
  );

  const toggleCommentLike = useCallback(
    (postId, commentId, currentUser) => {
      if (!currentUser) return;

      const commentPost = posts.find((p) => p.id === postId);
      const comment = commentPost?.comments?.items?.find((c) => c.id === commentId);
      const prevLiked = comment?.likes?.likedByCurrentUser || false;

      setPosts((currentPosts) => {
        return mutateToggleCommentLike(currentPosts, postId, commentId);
      });

      const { ok: commentLikeOk } = enqueue('TOGGLE_COMMENT_LIKE', {
        postId,
        commentId,
        userId: currentUser.id,
        liked: !prevLiked,
      });

      if (!commentLikeOk) {
        toast.warning('Local storage is full — your like may not persist.');
      }
    },
    [setPosts, posts]
  );

  const toggleReplyLike = useCallback(
    (postId, commentId, replyId, currentUser) => {
      if (!currentUser) return;

      const replyPost = posts.find((p) => p.id === postId);
      const replyComment = replyPost?.comments?.items?.find((c) => c.id === commentId);
      const reply = replyComment?.replies?.find((r) => r.id === replyId);
      const prevLiked = reply?.likes?.likedByCurrentUser || false;

      setPosts((currentPosts) => {
        return mutateToggleReplyLike(currentPosts, postId, commentId, replyId);
      });

      const { ok: replyLikeOk } = enqueue('TOGGLE_REPLY_LIKE', {
        postId,
        commentId,
        replyId,
        userId: currentUser.id,
        liked: !prevLiked,
      });

      if (!replyLikeOk) {
        toast.warning('Local storage is full — your like may not persist.');
      }
    },
    [setPosts, posts]
  );

  const updatePostPrivacy = useCallback(
    (postId, visibility, currentUser) => {
      if (!currentUser) return;

      setPosts((currentPosts) =>
        mutateUpdatePostPrivacy(currentPosts, postId, visibility)
      );
      const { ok: privacyEnqueueOk } = enqueue('UPDATE_POST_PRIVACY', {
        postId,
        visibility,
      });

      if (!privacyEnqueueOk) {
        toast.warning('Local storage is full — your privacy change may not persist.');
      }
    },
    [setPosts]
  );

  const retrySyncItem = useCallback(
    (postId) => {
      let postData = null;
      setPosts((prev) => {
        const p = prev.find((x) => x.id === postId);
        if (p) postData = p;
        return prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                syncStatus: 'pending',
                syncError: null,
                imageUploadStatus:
                  p.imageUploadStatus === 'failed' ? 'pending' : p.imageUploadStatus,
              }
            : p
        );
      });

      if (!postData) return;

      // Remove old failed queue items for this post
      const queue = readQueue();
      const filtered = queue.filter((q) => {
        const payloadPostId = q.payload?.localPostId || q.payload?.postId;
        return payloadPostId !== postId;
      });
      writeQueue(filtered);

      if (postData.remoteId) {
        // Post already synced; re-enqueue just the image update if needed
        if (
          postData.imageUploadStatus === 'failed' &&
          postData.image?.startsWith('/uploads/')
        ) {
          enqueue('UPDATE_POST_IMAGE', {
            localPostId: postData.id,
            remotePostId: postData.remoteId,
          });
        }
      } else {
        enqueue('CREATE_POST', {
          localPostId: postData.id,
          hasImage:
            !!postData.image && postData.image.startsWith('/uploads/'),
        });
      }
    },
    [setPosts]
  );

  return useMemo(
    () => ({
      createPost,
      togglePostLike,
      addComment,
      addReply,
      toggleCommentLike,
      toggleReplyLike,
      updatePostPrivacy,
      retrySyncItem,
    }),
    [
      createPost,
      togglePostLike,
      addComment,
      addReply,
      toggleCommentLike,
      toggleReplyLike,
      updatePostPrivacy,
      retrySyncItem,
    ]
  );
}

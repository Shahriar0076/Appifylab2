import { useCallback, useEffect } from 'react';
import { Avatar } from '../common/Avatar';
import { ReactionSummary } from './ReactionSummary';
import { ReactionBar } from './ReactionBar';
import { CommentForm } from './CommentForm';
import { CommentThread } from './CommentThread';
import { PrivacyToggle } from './PrivacyToggle';
import { getImageUrl } from '../../utils/getImageUrl';
import { getImage } from '../../utils/uploadImageStore';
import { useObjectUrl } from '../../hooks/useObjectUrl';

export function FeedPost({
  post,
  currentUser,
  uiText,
  onLikePost,
  onAddComment,
  onAddReply,
  onLikeComment,
  onLikeReply,
  onUpdatePrivacy,
  onRetrySync,
}) {
  const liked = post.likes?.likedByCurrentUser || false;
  const comments = post.comments?.items || [];
  const isOwner = currentUser?.id && post.author?.id === currentUser.id;

  // Determine image source priority: remote URL > IndexedDB > static asset
  const uploadedImagePath =
    typeof post.image === 'string' && post.image.startsWith('/uploads/') ? post.image : null;
  const { objectUrl: uploadedImageUrl, setBlob: setUploadedImageBlob, clearObjectUrl: clearUploadedImage } = useObjectUrl();

  useEffect(() => {
    if (post.imageRemoteUrl || !uploadedImagePath) {
      clearUploadedImage();
      return;
    }

    let cancelled = false;

    getImage(uploadedImagePath).then((blob) => {
      if (cancelled || !blob) return;
      setUploadedImageBlob(blob);
    });

    return () => {
      cancelled = true;
    };
  }, [uploadedImagePath, post.imageRemoteUrl, setUploadedImageBlob, clearUploadedImage]);

  let imageSrc = null;
  if (post.imageRemoteUrl) {
    imageSrc = post.imageRemoteUrl;
  } else if (uploadedImageUrl) {
    imageSrc = uploadedImageUrl;
  } else if (post.image) {
    imageSrc = getImageUrl(post.image);
  }

  const handleLike = useCallback(() => {
    onLikePost?.(post.id);
  }, [onLikePost, post.id]);

  const handleCommentSubmit = useCallback(
    (text) => {
      onAddComment?.(post.id, text, currentUser);
    },
    [onAddComment, post.id, currentUser]
  );

  const handleReply = useCallback(
    (commentId, text) => {
      onAddReply?.(post.id, commentId, text, currentUser);
    },
    [onAddReply, post.id, currentUser]
  );

  const handlePrivacyChange = useCallback(
    (visibility) => {
      onUpdatePrivacy?.(post.id, visibility);
    },
    [onUpdatePrivacy, post.id]
  );

  const showSyncStatus = post.syncStatus === 'pending' || post.syncStatus === 'failed';
  const showImageUploadStatus = post.imageUploadStatus === 'pending' || post.imageUploadStatus === 'failed';

  return (
    <div className="_feed_inner_timeline_post_area _b_radious6 _padd_b24 _padd_t24 _mar_b16">
      {showSyncStatus && (
        <div
          className={'_post_sync_status_wrap' + (post.syncStatus === 'failed' ? ' _post_sync_status_failed' : ' _post_sync_status_pending')}
        >
          {post.syncStatus === 'pending' && 'Saving...'}
          {post.syncStatus === 'failed' && (
            <span>
              Failed to sync{post.syncError ? `: ${post.syncError}` : ''} ·{' '}
              <button
                type="button"
                className="_post_sync_retry_btn"
                onClick={() => onRetrySync?.(post.id)}
              >
                Retry
              </button>
            </span>
          )}
        </div>
      )}
      {showImageUploadStatus && post.imageUploadStatus !== 'none' && (
        <div
          className={'_post_upload_status_wrap' + (post.imageUploadStatus === 'failed' ? ' _post_sync_status_failed' : ' _post_sync_status_pending')}
        >
          {post.imageUploadStatus === 'pending' && 'Uploading image...'}
          {post.imageUploadStatus === 'failed' && 'Image upload failed · Retry'}
        </div>
      )}

      <div className="_feed_inner_timeline_content _padd_r24 _padd_l24">
        <div className="_feed_inner_timeline_post_top">
          <div className="_feed_inner_timeline_post_box">
            <div className="_feed_inner_timeline_post_box_image">
              <Avatar
                name={post.author?.name}
                initials={post.author?.initials}
                background={post.author?.avatarColor}
                className="_post_img"
              />
            </div>
            <div className="_feed_inner_timeline_post_box_txt">
              <h4 className="_feed_inner_timeline_post_box_title">{post.author?.name}</h4>
              <p className="_feed_inner_timeline_post_box_para">
                {post.displayTime} .{' '}
                <span className="_post_visibility">
                  {post.visibility === 'public' ? 'Public' : 'Private'}
                </span>
              </p>
            </div>
          </div>
          {isOwner && (
            <div className="_post_privacy_toggle_wrap">
              <PrivacyToggle
                value={post.visibility || 'public'}
                onChange={handlePrivacyChange}
                options={[
                  { value: 'public', label: 'Public' },
                  { value: 'private', label: 'Private' },
                ]}
              />
            </div>
          )}
        </div>
        <h4 className="_feed_inner_timeline_post_title">{post.title}</h4>
        {imageSrc && (
          <div className="_feed_inner_timeline_image">
            <img
              src={imageSrc}
              alt={post.title}
              className="_time_img"
              loading="lazy"
              decoding="async"
              fetchPriority="low"
            />
          </div>
        )}
      </div>

      <ReactionSummary
        postRemoteId={post.remoteId}
        likes={post.likes}
        commentCount={comments.length}
        currentUser={currentUser}
      />

      <ReactionBar
        liked={liked}
        onLike={handleLike}
        uiText={uiText}
      />

      <div className="_feed_inner_timeline_cooment_area">
        <CommentForm
          currentUser={currentUser}
          placeholder={uiText?.commentPlaceholder || 'Write a comment'}
          onSubmit={handleCommentSubmit}
        />

        {comments.length > 0 && (
          <CommentThread
            comments={comments}
            currentUser={currentUser}
            uiText={uiText}
            onLikeComment={(commentId) => onLikeComment?.(post.id, commentId)}
            onLikeReply={(commentId, replyId) => onLikeReply?.(post.id, commentId, replyId)}
            onReply={handleReply}
          />
        )}
      </div>
    </div>
  );
}

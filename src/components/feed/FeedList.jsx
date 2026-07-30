import { FeedPost } from './FeedPost';

export function FeedList({
  posts,
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
  return (
    <>
      {posts.map((post) => (
        <FeedPost
          key={post.id}
          post={post}
          currentUser={currentUser}
          uiText={uiText}
          onLikePost={onLikePost}
          onAddComment={onAddComment}
          onAddReply={onAddReply}
          onLikeComment={onLikeComment}
          onLikeReply={onLikeReply}
          onUpdatePrivacy={onUpdatePrivacy}
          onRetrySync={onRetrySync}
        />
      ))}
    </>
  );
}

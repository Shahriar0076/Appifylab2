import { useState } from 'react';
import { CommentItem } from './CommentItem';

export function CommentThread({ comments, currentUser, uiText, onLikeComment, onLikeReply, onReply }) {
  const [showPrevious, setShowPrevious] = useState(false);
  const safeComments = comments || [];
  const latestComment = safeComments[safeComments.length - 1];
  const previousComments = safeComments.slice(0, -1);
  const hiddenCount = previousComments.length;
  const commentWord = hiddenCount === 1 ? 'comment' : 'comments';
  const label = `View ${hiddenCount} previous ${commentWord}`;
  const visiblePreviousComments = showPrevious ? previousComments : [];

  return (
    <div className="_timline_comment_main">
      {hiddenCount > 0 && !showPrevious && (
        <div className="_previous_comment">
          <button type="button" className="_previous_comment_txt" onClick={() => setShowPrevious(true)}>{label}</button>
        </div>
      )}
      {visiblePreviousComments.map((comment) => (
        <CommentItem
          key={comment.id}
          comment={comment}
          variant="comment"
          currentUser={currentUser}
          uiText={uiText}
          onLikeComment={onLikeComment}
          onLikeReply={onLikeReply}
          onReply={onReply}
        />
      ))}
      {latestComment && (
        <CommentItem
          key={latestComment.id}
          comment={latestComment}
          variant="comment"
          currentUser={currentUser}
          uiText={uiText}
          onLikeComment={onLikeComment}
          onLikeReply={onLikeReply}
          onReply={onReply}
        />
      )}
    </div>
  );
}

import { useState } from 'react';
import { Avatar } from '../common/Avatar';
import { CommentForm } from './CommentForm';
import { LikeIcon } from '../icons';

function CommentAvatar({ author, className }) {
  return (
    <a href="#0" className="_comment_image_link">
      <Avatar
        name={author?.name}
        initials={author?.initials}
        background={author?.avatarColor}
        className={className}
      />
    </a>
  );
}

function CommentLikeSummary({ comment, onLike, iconSize }) {
  return (
    <div className="_total_reactions">
      <div className="_total_react">
        <span className="_reaction_like" onClick={onLike}>
          <LikeIcon width={iconSize} height={iconSize} />
        </span>
      </div>
      <span className="_total">{comment.likes?.count || 0}</span>
    </div>
  );
}

export function CommentItem({
  comment,
  variant = 'comment',
  currentUser,
  uiText,
  onLikeComment,
  onLikeReply,
  onReply,
  parentCommentId
}) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const isReply = variant === 'reply';

  const handleLike = () => {
    if (isReply) {
      onLikeReply?.(parentCommentId, comment.id);
      return;
    }
    onLikeComment?.(comment.id);
  };

  // ------- Reply branch -------
  if (isReply) {
    return (
      <div className="_reply_main">
        <div className="_reply_image">
          <CommentAvatar author={comment.author} className="_reply_img" />
        </div>
        <div className="_reply_details">
          <div className="_reply_details_top">
            <div className="_reply_name">
              <a href="#0">
                <h4 className="_reply_name_title">{comment.author?.name}</h4>
              </a>
            </div>
          </div>
          <div className="_reply_status">
            <p className="_reply_status_text"><span>{comment.text}</span></p>
          </div>

          <CommentLikeSummary comment={comment} onLike={handleLike} iconSize={14} />

          <div className="_reply_actions">
            <ul className="_reply_action_list">
              <li>
                <span className="_reply_like_btn" onClick={handleLike}>Like.</span>
              </li>
              <li>
                <span className="_reply_time">.{comment.displayTime}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // ------- Comment branch -------
  return (
    <div className="_comment_main">
      <div className="_comment_image">
        <CommentAvatar author={comment.author} className="_comment_img1" />
      </div>
      <div className="_comment_area">
        <div className="_comment_details">
          <div className="_comment_details_top">
            <div className="_comment_name">
              <a href="#0">
                <h4 className="_comment_name_title">{comment.author?.name}</h4>
              </a>
            </div>
          </div>
          <div className="_comment_status">
            <p className="_comment_status_text"><span>{comment.text}</span></p>
          </div>

          <CommentLikeSummary comment={comment} onLike={handleLike} iconSize={16} />

          <div className="_comment_reply">
            <div className="_comment_reply_num">
              <ul className="_comment_reply_list">
                <li>
                  <span className="_comment_like_btn" onClick={handleLike}>Like.</span>
                </li>
                <li>
                  <span className="_comment_reply_btn" onClick={() => setShowReplyForm(!showReplyForm)}>Reply.</span>
                </li>
                <li>
                  <span className="_time_link">.{comment.displayTime}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {showReplyForm && (
          <div className="_comment_reply_form_wrap">
            <CommentForm
              currentUser={currentUser}
              placeholder={uiText?.replyPlaceholder || 'Write a reply...'}
              onSubmit={(text) => {
                onReply?.(comment.id, text);
                setShowReplyForm(false);
              }}
            />
          </div>
        )}

        {comment.replies?.map((reply) => (
          <div key={reply.id} className="_comment_reply_item_wrap">
            <CommentItem
              comment={reply}
              variant="reply"
              currentUser={currentUser}
              uiText={uiText}
              onLikeComment={onLikeComment}
              onLikeReply={onLikeReply}
              onReply={onReply}
              parentCommentId={comment.id}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

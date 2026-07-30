import { useState } from 'react';
import { Avatar } from '../common/Avatar';
import { SendIcon } from '../icons';

export function CommentForm({ currentUser, placeholder, onSubmit }) {
  const [text, setText] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSubmit?.(text);
    setText('');
  };

  const handleKeyDown = (e) => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    e.preventDefault();
    if (!text.trim()) return;
    onSubmit?.(text);
    setText('');
  };

  return (
    <div className="_feed_inner_comment_box">
      <form className="_feed_inner_comment_box_form" onSubmit={handleSubmit}>
        <div className="_feed_inner_comment_box_content">
          <div className="_feed_inner_comment_box_content_image">
            <Avatar
              name={currentUser?.name}
              initials={currentUser?.initials}
              background={currentUser?.avatarColor}
              className="_comment_img"
            />
          </div>
          <div className="_feed_inner_comment_box_content_txt">
            <textarea
              className="form-control _comment_textarea"
              placeholder={placeholder || 'Write a comment'}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
        </div>
        <div className="_feed_inner_comment_box_icon">
          <button className="_feed_inner_comment_box_icon_btn" type="submit">
            <SendIcon />
          </button>
        </div>
      </form>
    </div>
  );
}

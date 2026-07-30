import { LikeIcon, CommentIcon } from '../icons';

export function ReactionBar({ liked, onLike, uiText }) {
  return (
    <div className="_feed_inner_timeline_reaction">
      <button
        type="button"
        className={`_feed_inner_timeline_reaction_like _feed_reaction ${liked ? '_liked' : ''}`}
        onClick={onLike}
      >
        <span className="_feed_inner_timeline_reaction_link">
          <span>
            <LikeIcon className="_reaction_svg" />
            {uiText?.actions?.like || 'Like'}
          </span>
        </span>
      </button>
      <button type="button" className="_feed_inner_timeline_reaction_comment _feed_reaction">
        <span className="_feed_inner_timeline_reaction_link">
          <span>
            <CommentIcon className="_reaction_svg" />
            {uiText?.actions?.comment || 'Comment'}
          </span>
        </span>
      </button>
    </div>
  );
}

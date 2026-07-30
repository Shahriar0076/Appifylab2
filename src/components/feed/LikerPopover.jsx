import { useEffect, useState } from 'react';
import { getPostLikers, getCommentLikers, getReplyLikers } from '../../services/firestoreFeedService';

export function LikerPopover({ targetType, targetId, onClose }) {
  const [likers, setLikers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadLikers() {
      setIsLoading(true);
      try {
        let users = [];
        if (targetType === 'post') {
          users = await getPostLikers(targetId);
        } else if (targetType === 'comment') {
          users = await getCommentLikers(targetId);
        } else if (targetType === 'reply') {
          users = await getReplyLikers(targetId);
        }

        if (!cancelled) {
          setLikers(users);
        }
      } catch (err) {
        console.warn('Failed to load likers:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadLikers();

    return () => {
      cancelled = true;
    };
  }, [targetType, targetId]);

  return (
    <div className="_liker_popover">
      <div className="_liker_popover_header">
        <span>Liked by</span>
        <button
          type="button"
          className="_liker_popover_close"
          onClick={onClose}
          aria-label="Close"
        >
          &times;
        </button>
      </div>
      {isLoading ? (
        <p className="_liker_popover_message">
          Loading...
        </p>
      ) : likers.length === 0 ? (
        <p className="_liker_popover_message">
          No likes yet
        </p>
      ) : (
        likers.map((user) => (
          <div key={user.id} className="_liker_popover_user">
            <div
              className="_liker_popover_avatar"
              style={{ background: user.avatarColor || '#1890FF' }}
            >
              {user.initials || user.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <span className="_liker_popover_user_name">{user.name}</span>
          </div>
        ))
      )}
    </div>
  );
}

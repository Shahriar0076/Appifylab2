export function ReactionSummary({ likes, commentCount, currentUser }) {
  const basePreviewUsers = likes?.previewUsers || [];
  const hasCurrentUserPreview = currentUser?.id && basePreviewUsers.some((user) => user.id === currentUser.id);
  const allPreviewUsers = likes?.likedByCurrentUser && currentUser && !hasCurrentUserPreview
    ? [currentUser, ...basePreviewUsers]
    : basePreviewUsers;
  const previewUsers = allPreviewUsers;

  return (
    <div className="_feed_inner_timeline_total_reacts _padd_r24 _padd_l24 _mar_b26">
      <div className="_feed_inner_timeline_total_reacts_image">
        {previewUsers.map((user, idx) => (
          <div
            key={user.id}
            className={
              idx === 0
                ? '_react_img1 _letter_avatar'
                : '_react_img _letter_avatar'
            }
            style={{
              background: user.avatarColor,
              color: user.color || '#fff',
              zIndex: previewUsers.length - idx,
            }}
          >
            {user.initials || user.name?.charAt(0).toUpperCase()}
          </div>
        ))}
      </div>
      <div className="_feed_inner_timeline_total_reacts_txt">
        <p className="_feed_inner_timeline_total_reacts_para2">
          <span>{likes?.count || 0}</span> Likes
        </p>
        <p className="_feed_inner_timeline_total_reacts_para1">
          <a href="#0"><span className="_comment_count">{commentCount || 0}</span> Comments</a>
        </p>
      </div>
    </div>
  );
}

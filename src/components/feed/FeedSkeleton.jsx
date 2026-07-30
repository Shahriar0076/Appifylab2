export function FeedSkeleton({ count = 3 }) {
  return (
    <div className="_feed_skeleton_wrap">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="_feed_inner_timeline_post_area _b_radious6 _padd_b24 _padd_t24 _mar_b16 _feed_skeleton_card"
          aria-hidden="true"
        >
          <div className="_feed_inner_timeline_content _padd_r24 _padd_l24">
            {/* ── Header: Avatar + Name / Time ── */}
            <div className="_feed_inner_timeline_post_top">
              <div className="_feed_inner_timeline_post_box">
                <div className="_feed_inner_timeline_post_box_image">
                  <div className="_feed_skeleton_avatar _feed_skeleton_shimmer" />
                </div>
                <div className="_feed_inner_timeline_post_box_txt">
                  <div className="_feed_skeleton_line _feed_skeleton_shimmer _feed_skeleton_line_name" />
                  <div className="_feed_skeleton_line _feed_skeleton_shimmer _feed_skeleton_line_time _mar_t8" />
                </div>
              </div>
            </div>

            {/* ── Post content lines ── */}
            <div className="_feed_skeleton_line _feed_skeleton_shimmer _feed_skeleton_line_body_1 _mar_b8" />
            <div className="_feed_skeleton_line _feed_skeleton_shimmer _feed_skeleton_line_body_2 _mar_b16" />

            {/* ── Image placeholder ── */}
            <div className="_feed_skeleton_image_block _feed_skeleton_shimmer _mar_b24" />

            {/* ── Reaction summary row ── */}
            <div className="_dis_flex _flex_space _mar_b16">
              <div className="_dis_flex _dis_flex_cntr1">
                <div className="_feed_skeleton_avatar_sm _feed_skeleton_shimmer" />
                <div className="_feed_skeleton_avatar_sm _feed_skeleton_shimmer _feed_skeleton_avatar_overlap" />
                <div className="_feed_skeleton_avatar_sm _feed_skeleton_shimmer _feed_skeleton_avatar_overlap" />
                <div className="_feed_skeleton_line _feed_skeleton_shimmer _feed_skeleton_line_reaction _mar_l8" />
              </div>
              <div className="_feed_skeleton_line _feed_skeleton_shimmer _feed_skeleton_line_comment_count" />
            </div>

            {/* ── Reaction action bar ── */}
            <div className="_feed_inner_timeline_reaction" style={{ padding: '8px 0', background: 'transparent' }}>
              <div className="_feed_skeleton_btn _feed_skeleton_shimmer" />
              <div className="_feed_skeleton_btn _feed_skeleton_shimmer" />
            </div>

            <hr className="_underline _mar_b16" />

            {/* ── Comment form row ── */}
            <div className="_dis_flex _dis_flex_cntr1">
              <div className="_feed_skeleton_avatar_xs _feed_skeleton_shimmer _mar_r8" />
              <div className="_feed_skeleton_comment_input _feed_skeleton_shimmer" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

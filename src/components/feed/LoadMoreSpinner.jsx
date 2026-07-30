/**
 * LoadMoreSpinner — shown at the bottom of the feed while fetching
 * the next page of remote posts, or when all posts are loaded.
 */
export function LoadMoreSpinner({ isLoadingMore, hasMore }) {
  if (isLoadingMore) {
    return (
      <div className="_load_more_wrap">
        <div className="_load_more_spinner" />
        <span className="_load_more_text">Loading more posts...</span>
      </div>
    );
  }

  if (!hasMore) {
    return (
      <div className="_load_more_end">
        No more posts to show
      </div>
    );
  }

  return null;
}

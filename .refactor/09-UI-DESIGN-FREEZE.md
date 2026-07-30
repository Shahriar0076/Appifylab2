# 09 — UI and Design Freeze

## Purpose

The data refactor must not redesign the application. Current visual and interaction behavior is an acceptance contract.

## Frozen files during Phases 0–8

Do not edit unless a task explicitly requires a minimal adapter prop and visual tests prove parity:

```text
src/assets/css/bootstrap.min.css
src/assets/css/common.css
src/assets/css/main.css
src/assets/css/responsive.css
src/components/feed/Header.jsx
src/components/feed/PostComposer.jsx
src/components/feed/FeedList.jsx
src/components/feed/FeedPost.jsx
src/components/feed/CommentThread.jsx
src/components/feed/CommentItem.jsx
src/components/feed/CommentForm.jsx
src/components/feed/ReactionSummary.jsx
src/components/feed/ReactionBar.jsx
src/components/feed/PrivacyToggle.jsx
src/pages/FeedPage.jsx
```

If an adapter is unavoidable, preserve rendered DOM order, elements, attributes, copy, and classes.

## Frozen layout and styling contracts

- Header/logo/profile/logout placement.
- Center feed width and Bootstrap container/grid structure.
- Composer avatar, textarea, photo control, privacy toggle, post button.
- Separate desktop and mobile composer controls.
- Six-pixel post/composer radius and existing spacing utility classes.
- Post author/time/visibility/privacy placement.
- Image aspect/size behavior and lazy-loading attributes.
- Reaction summary, like/comment bar, comment form, previous-comment expansion, one-level replies.
- Desktop/tablet/mobile breakpoints already defined by CSS.
- Existing fonts, colors, icon assets, toast placement, skeleton appearance, and loading spinner.

## Frozen interaction contracts

- Authenticated users land on `/feed`; unauthenticated users are protected.
- Cached content may appear before network refresh.
- Two posts are revealed at a time.
- Infinite scroll preloads before the end.
- Text-only, image-only, and text+image posts are supported.
- Images validate/resize before posting and preview immediately.
- Public/private defaults and owner-only privacy editing remain.
- Likes/comments/replies update optimistically.
- Replies remain one level deep.
- Current sync/offline/storage feedback remains visible using existing surfaces.
- A failed post/image remains retryable.

## Permitted backend-driven differences

Only these semantic improvements are expected:

- pending state comes from Firestore metadata rather than the old queue;
- image status comes from the media job;
- error text may become more accurate, but copy changes require snapshot review;
- stale counter hints may be replaced by canonical collection-derived counts;
- duplicate entities disappear;
- cross-account operations no longer run.

## Prop/API compatibility

Keep the `FeedContext` values used by `FeedPage` until the final cleanup:

```text
posts
isLoading
isFetchingRemote
syncStatusMessage
isOnline
storageWarning
hasMoreRemote
isLoadingMore
createPost
togglePostLike
addComment
addReply
toggleCommentLike
toggleReplyLike
updatePostPrivacy
fetchAndMergeRemotePosts
loadMoreRemotePosts
retrySyncItem
```

The new controller may implement them differently. Do not force the presentation tree to understand repositories, Firestore snapshots, queue leases, or schema versions.

## Screenshot baselines

Use the states and viewports in `07-TEST-AND-VERIFICATION-PLAN.md`. Store snapshots in the test system, not in `.refactor`.

Comparison rules:

- zero pixel/DOM difference for normal loading and content states;
- dynamic relative time may be fixed by clock mocking;
- object/blob URLs may be masked, but rendered image dimensions cannot;
- sync-status copy differences need explicit review;
- do not approve a broad baseline replacement to hide regressions.

## Accessibility preservation

Backend work must not remove:

- button types;
- input labels/placeholders;
- image alt text;
- title/aria-label values;
- keyboard Enter behavior for comments;
- disabled states while image processing;
- semantic form submission.

Any later accessibility improvement belongs in a separate UI task.


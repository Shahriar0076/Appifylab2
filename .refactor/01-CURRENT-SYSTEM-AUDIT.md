# 01 — Current System Audit

## Runtime topology

```text
Firebase Auth
  -> AuthContext loads users/{uid}
  -> FeedProvider mounts for /feed
      -> useFeedData
           -> reads a UID-scoped nested feed from localStorage
           -> fetches two Firestore post queries
           -> merges remote posts with local optimistic objects
           -> fetches comments/replies/likes
           -> subscribes to post likes
           -> writes every posts[] change back to localStorage
      -> useFeedActions
           -> mutates React posts[] optimistically
           -> stores image blobs in IndexedDB
           -> appends a command to a global localStorage queue
      -> useSyncQueueProcessor
           -> reads that queue
           -> uploads images to Cloudinary
           -> writes Firestore
           -> mutates React posts[] with remote IDs/status
```

The presentation layer receives one deeply nested `posts[]` graph. That graph currently contains domain data, remote data, local-only image paths, identity aliases, sync state, and presentation fields.

## Entry and ownership map

| Area | Current owner | Evidence |
|---|---|---|
| Authentication session | `AuthContext` + Firebase Auth | `src/context/AuthContext.jsx:22-79` |
| User profile | `authService.getUserProfile` | `src/services/authService.js:71-92` |
| Feed React state | `useFeedData` | `src/hooks/useFeedData.js:84-149` |
| Optimistic commands | `useFeedActions` | `src/hooks/useFeedActions.js:32-397` |
| Background mutation loop | `useSyncQueueProcessor` | `src/hooks/useSyncQueueProcessor.js:48-462` |
| Durable JSON helpers | `utils/storage.js` | `src/utils/storage.js:7-70` |
| Durable mutation queue | `syncQueueService.js` | `src/services/syncQueueService.js:3-168` |
| Local image blobs | `uploadImageStore.js` | `src/utils/uploadImageStore.js:1-89` |
| Firestore reads/writes/mapping | one 926-line service | `src/services/firestoreFeedService.js:1-926` |
| Cloudinary upload | `cloudinaryService.js` | `src/services/cloudinaryService.js:13-43` |
| UI orchestration | `FeedContext` and `FeedPage` | `src/context/FeedContext.jsx:10-63`, `src/pages/FeedPage.jsx:16-259` |

## Local persistence inventory

### `localStorage`

| Key | Scope | Shape | Writer/readers |
|---|---|---|---|
| `buddyScript.feed.posts.${encodeURIComponent(uid)}` | per UID | Entire nested UI `posts[]` graph | `useFeedData` |
| `buddyScript.feed.version.${encodeURIComponent(uid)}` | per UID | String `"3"` | `useFeedData` |
| `buddyScript.feed.syncQueue` | global, not per UID | Array of queue commands | `syncQueueService` |
| `${postsKey}.corrupt` | per UID | Raw backup string | `storage.backupCorrupted` |

The feed cache is versioned, but the queue is neither versioned nor user-scoped. The queue also has no schema validator.

### IndexedDB

| Database | Version | Store | Key | Value |
|---|---:|---|---|---|
| `buddyScriptImages` | 1 | `postImages` | virtual path such as `/uploads/post-<uuid>.jpg` | JPEG `Blob` |

Image keys do not contain a UID. `clearAllImages()` clears every account’s images. Successfully uploaded blobs are not deleted.

## Current local UI shapes

### Post

```js
{
  id,                 // local ID before sync; remote document ID after some merges
  remoteId,           // null locally; Firestore ID remotely
  localId,            // present on normalized remote posts
  syncStatus,         // local posts only: pending | synced | failed
  syncError,
  imageUploadStatus,  // none | pending | synced | failed
  image,              // local IDB virtual path or legacy static asset name
  imageRemoteUrl,
  imagePublicId,
  author,
  createdAt,
  displayTime,
  visibility,
  title,
  likes: { count, likedByCurrentUser, previewUsers },
  comments: { previousCount, items }
}
```

### Comment/reply

Comments and replies use the same split identity model: local `id`, later `remoteId`, and remote `localId`. Comments nest replies in the UI even though Firestore stores them in separate top-level collections.

### Queue item

```js
{
  id,
  type,
  payload,
  status: 'pending' | 'syncing' | 'failed',
  attempts,
  error,
  createdAt,
  updatedAt
}
```

Supported types are `CREATE_POST`, `UPDATE_POST_IMAGE`, `ADD_COMMENT`, `ADD_REPLY`, three like toggles, and `UPDATE_POST_PRIVACY`.

## Current read path

1. Auth state resolves, then a Firestore user profile is fetched.
2. `useFeedData` reads the UID-scoped cache and renders it immediately.
3. `FeedPage` calls `fetchAndMergeRemotePosts(currentUser)`.
4. Firestore runs a public-post query and a current-user-private-post query, each limited to 10, and merges them.
5. The first page intentionally omits engagement for first paint.
6. Comments/replies are fetched afterward.
7. Post likes use live `onSnapshot` subscriptions in batches of 10 post IDs.
8. Each remote result is merged into the nested local graph.
9. Every resulting state change serializes the whole graph back to `localStorage`.

Important implementation locations:

- Cache load/persist: `useFeedData.js:39-149`.
- Queue-aware likes merge: `useFeedData.js:152-355`.
- Post identity merge: `useFeedData.js:357-425`.
- Initial fetch/deferred comments: `useFeedData.js:427-491`.
- Pagination: `useFeedData.js:493-517`.
- Public/private Firestore pagination: `firestoreFeedService.js:576-690`.

## Current write path

1. A UI action constructs a local object and calls `setPosts`.
2. The action calls `enqueue` separately.
3. A window event wakes the queue processor.
4. The processor reads the first active queue item and marks it syncing.
5. It looks up current nested state to resolve local-to-remote IDs.
6. It performs Cloudinary and/or Firestore work.
7. It mutates nested React state with remote IDs and statuses.
8. It removes the queue item.
9. `useFeedData` serializes the resulting graph.

This path has no atomic boundary between the optimistic entity and its queue record.

## Current Firestore schema

| Collection | ID | Key fields |
|---|---|---|
| `users` | Firebase UID | `firstName`, `lastName`, `email`, `avatarColor`, timestamps |
| `posts` | auto ID for app-created posts; known ID for seed data | `localId`, `userId`, `text`, image fields, `visibility`, timestamps, counters, `author` |
| `comments` | auto ID for app-created comments | `localId`, `postId`, `userId`, `text`, timestamps, counters, `author` |
| `replies` | auto ID for app-created replies | `localId`, `postId`, `commentId`, `userId`, `text`, timestamps, counter, `author` |
| `postLikes` | `${postId}_${uid}` | `postId`, `userId`, `createdAt` |
| `commentLikes` | `${commentId}_${uid}` | `postId`, `commentId`, `userId`, `createdAt` |
| `replyLikes` | `${replyId}_${uid}` | `postId`, `commentId`, `replyId`, `userId`, `createdAt` |

The seed script uses deterministic IDs; the browser creation services use `addDoc`. This means production data already has mixed identity behavior.

## Current presentation contract

The feed page:

- reveals cached/remote posts two at a time;
- fetches another remote page after cached posts are exhausted;
- shows branded skeletons while no feed is available;
- shows offline, storage, and sync status banners;
- creates text/image posts with public/private selection;
- renders local IndexedDB images before remote URLs;
- permits privacy changes only for the displayed owner;
- supports optimistic likes, comments, one-level replies, and their likes;
- shows retry only at post level.

These contracts are defined primarily by `FeedPage.jsx`, `PostComposer.jsx`, `FeedPost.jsx`, `CommentThread.jsx`, and `CommentItem.jsx`. They are frozen during the data refactor.

## Baseline quality state

- `npm run lint` passes with existing warnings in `AuthContext`, `FeedContext`, `useAuthPage`, and `seed.mjs`.
- `npm run build` passes.
- The production build reports a large Firebase-related chunk.
- No tests exist.
- No Firebase emulator configuration exists.
- `postService.js`, `userService.js`, the seed JSON post path, and seed normalization helpers appear disconnected from the active feed.

## Main coupling points

1. UI IDs double as persistence lookup IDs.
2. Remote normalization constructs presentation fields such as `displayTime`.
3. Queue execution reaches directly into React’s nested posts graph.
4. Live Firestore listeners read the global queue to decide UI state.
5. A single service performs queries, mapping, profile caching, subscriptions, commands, transactions, and counter maintenance.
6. Image upload state is stored partly in the post graph, partly in IndexedDB, and partly in the queue.
7. Sync status is inferred from both entity fields and queue fields with no canonical state machine.


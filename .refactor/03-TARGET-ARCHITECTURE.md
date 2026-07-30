# 03 — Target Architecture

## Architectural decision

Use Firestore’s persistent local cache and native offline write pipeline for all Firestore-backed entities. Keep a small custom IndexedDB database only for image blobs and image-upload jobs because those assets are external to Firestore.

Do not build a second general-purpose client database/outbox beside Firestore. The present duplication is the main source of reconciliation complexity.

## Ownership model

```text
Presentation
  FeedPage + existing feed components
       |
       v
Application
  FeedContext facade
  useFeedController
  feedCommands
       |
       v
Repository contract
  subscribeFeed / loadNextPage / createPost / addComment / ...
       |
       +---------------------------+
       |                           |
       v                           v
Firestore adapter             Media adapter
  persistent cache              IndexedDB:
  snapshots + metadata          imageBlobs
  idempotent writes             imageJobs + leases
       |                           |
       v                           v
Firestore backend             Cloudinary gateway
```

## Source-of-truth rules

1. Firebase Auth UID is the only account identity.
2. Firestore documents and Firestore’s persistent cache are canonical for posts, comments, replies, likes, and privacy.
3. Firestore snapshot metadata is canonical for pending Firestore writes.
4. IndexedDB is canonical only for image blobs, durable image jobs, upload receipts, and job leases.
5. Remote URLs stored on the post are canonical after media upload.
6. React state is a projection, never an independent durable database.
7. `localStorage` is legacy migration input only.

## Stable identity

Generate a collision-resistant client ID before the first write:

```text
post_<UUID>
comment_<UUID>
reply_<UUID>
```

Use that same value for:

- UI `id`;
- Firestore document ID;
- parent references;
- image blob/job references;
- React keys;
- retry/idempotency identity.

For old documents, mappers continue accepting Firestore IDs plus `localId`/`remoteId`. New writers do not create a second identity.

Like documents remain deterministic per target and user:

```text
postLikes/{postId}__{uid}
commentLikes/{commentId}__{uid}
replyLikes/{replyId}__{uid}
```

Use a delimiter and encoding function owned by one module. Continue reading legacy underscore IDs; do not rename existing likes during the first cutover.

## Target modules

### Domain

Pure functions, no React, browser globals, Firebase, Cloudinary, or toast calls:

```text
src/domain/feed/
  ids.js
  model.js
  invariants.js
  merge.js
  selectors.js
```

Responsibilities:

- canonical UI shapes;
- stable identity aliases for legacy objects;
- visibility and entity validators;
- deterministic merge/reconciliation;
- selectors that build the existing nested `posts[]` presentation contract.

### Firestore data layer

```text
src/data/firestore/
  client.js
  converters.js
  profileRepository.js
  postRepository.js
  commentRepository.js
  reactionRepository.js
  feedQuery.js
```

Responsibilities:

- initialize Firestore once with persistent multi-tab local cache before any `getFirestore` call;
- isolate collection paths and field names;
- map snapshots with server timestamp estimates;
- issue deterministic `setDoc`, `updateDoc`, and `deleteDoc` commands;
- expose subscriptions and pagination cursors;
- never create UI toasts or mutate React state;
- never write legacy counters from the browser.

### Feed application layer

```text
src/features/feed/
  feedRepository.js
  feedController.js
  feedCommands.js
  feedStatus.js
```

Responsibilities:

- compose public/private post streams;
- subscribe only to engagement needed by loaded/visible posts;
- expose the current nested UI projection;
- map Firestore metadata to per-entity and global sync status;
- invoke media jobs for posts with images;
- preserve the existing `FeedContext` public API during migration.

### Media layer

```text
src/data/media/
  imageDatabase.js
  imageJobRepository.js
  cloudinaryGateway.js
src/features/media/
  imageUploadWorker.js
  imageStatus.js
```

Responsibilities:

- one versioned IndexedDB database;
- stores `imageBlobs` and `imageJobs`;
- one transaction creates/updates a blob and its job;
- jobs contain UID, post ID, attempts, next-attempt time, receipt, and lease;
- only the matching authenticated UID’s worker may claim a job;
- lease prevents duplicate workers across tabs;
- persist upload result before attempting the Firestore URL update;
- delete blob/job only after the post URL write is acknowledged;
- quarantine unrecoverable jobs rather than silently deleting them.

## Firestore initialization

`src/config/firebaseFirestore.js` must stop calling `getFirestore(firebaseApp)` directly. Initialize once, before any Firestore access, using the installed Firebase version’s supported persistent cache and multi-tab manager APIs.

Expected behavior:

- if persistent cache initializes, snapshots and writes survive refresh/offline periods;
- if persistence is unavailable, fall back to memory cache with a visible diagnostic, not a crash;
- initialization result is observable in tests;
- only one module may initialize the Firestore instance.

The exact Firebase 12.16 API must be verified against installed type declarations during implementation.

## Command behavior

### Create post without image

1. Generate `postId`.
2. Call `setDoc(posts/{postId}, completePost, {merge:false})`.
3. Firestore immediately emits a local snapshot with `hasPendingWrites`.
4. UI renders it through the repository.
5. Firebase syncs when reachable.

### Create post with image

1. Generate `postId`.
2. In one IndexedDB transaction, save blob and image job scoped to UID/post.
3. Write `posts/{postId}` with no remote image URL and an image-pending marker understood by the mapper.
4. UI renders the IndexedDB blob.
5. Media worker uploads, persists the receipt, updates the post URL, then removes the local blob/job after acknowledgement.

If the Firestore write fails validation, keep the image job quarantined and show a recoverable error. Never orphan it silently.

### Comment/reply

Use deterministic `setDoc` on the entity. Do not update parent counters from the client. The relevant snapshot supplies the optimistic entity.

### Likes

Use deterministic `setDoc` for like and `deleteDoc` for unlike. Do not use client transactions or mutate entity counters. The like collection is canonical; live listeners derive count and current-user state.

### Privacy

Use an owner-only `updateDoc` restricted to `visibility` and `updatedAt`. Existing child reads must follow the parent’s current visibility through rules.

## Status model

Do not collapse every condition into “online/offline.”

```js
{
  browser: 'online' | 'offline',
  firestore: 'live' | 'cache' | 'error',
  pendingFirestoreWrites: number,
  media: 'idle' | 'uploading' | 'retrying' | 'blocked',
  persistence: 'persistent' | 'memory-fallback' | 'unavailable'
}
```

Existing banners can project this model into the current copy/classes. A design change is not required.

## Why the current collection layout stays

Top-level `comments`, `replies`, and like collections support existing batched `in` queries across loaded posts. Moving them under each post would require data backfill, dual reads, new listeners, new rules, and different query costs at the same time as the sync rewrite.

This plan hardens the existing schema instead:

- deterministic IDs;
- explicit parent references;
- rules that verify the referenced parent;
- converters and validators;
- browser clients do not maintain counters.

A nested-collection migration can be evaluated later as a separate product/backend project.

## Dependency direction

Allowed:

```text
components -> FeedContext facade -> feature/application -> repository interfaces
repository implementations -> Firebase/IndexedDB/Cloudinary
all layers -> pure domain
```

Forbidden:

```text
components -> Firestore/IndexedDB/Cloudinary
Firestore service -> React setters/toasts
sync worker -> nested React posts graph
domain -> browser/Firebase/React
live query -> legacy localStorage queue
```


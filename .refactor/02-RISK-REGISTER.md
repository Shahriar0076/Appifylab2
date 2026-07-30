# 02 — Risk Register

Severity meanings:

- **P0:** can lose user intent, duplicate data, cross account boundaries, or expose private data.
- **P1:** produces incorrect state, broken features, unbounded growth, or recovery problems.
- **P2:** maintainability/performance debt that makes future defects likely.

## P0 correctness and security risks

### R-01 — A global queue can be processed under the wrong account

- Evidence: `QUEUE_STORAGE_KEY` is `buddyScript.feed.syncQueue` in `src/services/syncQueueService.js:3`; queue items have no `ownerId`.
- Trigger: user A leaves work pending, logs out, then user B logs in.
- Failure: user B’s processor reads user A’s commands. Missing entities are sometimes treated as successfully synced, so user A’s work can be discarded.
- Required fix: immediately version and UID-scope the legacy queue; never execute an item unless `item.ownerId === auth.currentUser.uid`.
- Required tests: two accounts, logout with pending post/comment/like/image, login as second account, verify zero writes and zero removals from the first account’s outbox.

### R-02 — Retryable creates are not idempotent

- Evidence: `createRemotePost`, `addRemoteComment`, and `addRemoteReply` use `addDoc` at `firestoreFeedService.js:696-777`.
- Trigger: the request reaches Firestore but the client times out or crashes before recording the returned ID.
- Failure: retry creates duplicate posts/comments/replies.
- Amplifier: `withTimeout` rejects locally but does not cancel the underlying request.
- Required fix: use one client-generated entity ID as the Firestore document ID and use idempotent `setDoc`.
- Required tests: simulate ack loss after remote success, retry the same command, assert one document.

### R-03 — Firestore rules and client counter writes conflict

- Evidence:
  - Adding a comment writes the comment, then updates the parent post counter (`firestoreFeedService.js:731-751`).
  - Post rules allow a non-owner update only for `likesCount` and `updatedAt` (`firestore.rules:54-61`).
  - Adding a reply updates the parent comment (`firestoreFeedService.js:758-777`), but comment updates are author-only (`firestore.rules:78-82`).
  - Comment/reply like transactions update the liked entity (`firestoreFeedService.js:830-914`), but those updates are author-only.
- Failure:
  - commenting on someone else’s post can create the comment and then fail the counter update;
  - replying to someone else’s comment can create the reply and then fail;
  - liking someone else’s comment/reply can fail completely;
  - split operations can leave partial remote state.
- Required fix: stop client counter updates. Collections are canonical; counters are read-only legacy/derived fields until a trusted server maintainer exists.
- Required tests: emulator matrix for owner/non-owner comment, reply, and all like operations.

### R-04 — Split local/remote identities can drop queued intent

- Evidence:
  - optimistic entities start with local `id` and null `remoteId`;
  - remote mapping sets Firestore doc ID as `id`;
  - post merge handles `localId`, but comment/reply merge primarily compares `id` (`useFeedData.js:261-328`);
  - queue payloads keep the ID that existed when the user clicked.
- Trigger: a remote refresh replaces a local entity before its dependent command runs.
- Failure: processor lookup misses the entity and may mark a like/privacy command synced without writing it. Pending comments can be duplicated when the remote document is matched only by remote `id`.
- Required fix: one stable ID from creation through Firestore; during migration, all matching must use `{id, localId, remoteId}` aliases through a single identity helper.
- Required tests: comment/like and post/privacy operations while the remote document arrives between enqueue and processing.

### R-05 — Multiple queue processors can execute the same item

- Evidence: `useSyncQueueProcessor` starts an un-cancelled async loop and cleanup only resets `processingRef` (`useSyncQueueProcessor.js:48-462`).
- Trigger: React StrictMode effect replay, dependency change, route unmount/remount, or multiple tabs.
- Failure: concurrent workers observe the same queue item. Non-idempotent operations duplicate.
- Required fix: first make writes idempotent; then add worker cancellation and, for the remaining image-job queue, a transactional lease.
- Required tests: StrictMode mount replay, two tabs/workers, unmount during request, and expired lease recovery.

### R-06 — Private post children are broadly readable

- Evidence: comments and replies are readable by any authenticated user at `firestore.rules:71-101`; like collections are also globally readable to authenticated users.
- Failure: knowing or querying IDs can expose comments, replies, and reaction relationships belonging to a private post.
- Required fix: child and like reads must verify access to their parent post. Queries must include parent IDs that the caller can read.
- Required tests: unauthenticated, unrelated authenticated, owner, public-post reader, and private-post reader cases.

### R-07 — Optimistic state and outbox persistence are not atomic

- Evidence: each action calls React `setPosts` and `enqueue` separately in `useFeedActions.js`.
- Trigger: queue quota failure, refresh/crash between calls, or processor wake before the state render is committed.
- Failure: visible data has no durable command, or a command depends on entity data not yet visible to the processor. `CREATE_POST` stores only `localPostId`, so the queue itself cannot reconstruct the post.
- Required fix: Firestore local persistence becomes the atomic durable write path for Firestore entities. Image blob + image job must share one IndexedDB transaction.
- Required tests: injected failure before/after each persistence boundary.

## P1 reliability risks

### R-08 — Failed queue writes are often ignored

`markSyncing`, `markSynced`, and `markFailed` ignore the return from `writeQueue`. The UI can report completion even if durable queue state was not updated.

### R-09 — Queue payloads are not validated or versioned

Malformed, stale, or partially written items pass into the switch. Unknown types are removed as synced by the default branch.

### R-10 — Queue items are never compacted

Rapid like toggles and privacy changes create redundant commands. Intermediate acknowledgements can make the UI jump between old and new intent.

### R-11 — Dependency failure can be reported as success

When a parent is not synced, comment/reply cases call `markFailed` and `break`; the common success toast still runs. That path also retries on the normal 500 ms loop rather than the documented backoff.

### R-12 — Connectivity is modeled as a browser boolean

`navigator.onLine` says that a network interface exists; it does not prove Firebase or Cloudinary reachability. The system needs separate browser, Firestore snapshot, pending-write, and media-job states.

### R-13 — Image storage is not user-scoped or garbage-collected

Uploaded blobs remain forever. `resetFeed` invokes `clearAllImages()` for every account and does not await/catch it. Image database connections are opened repeatedly and not explicitly closed.

### R-14 — Cloudinary uploads have an ambiguous retry window

The upload can succeed remotely while the response is lost. Without a deterministic public ID or a locally persisted successful upload receipt, retry can create orphaned duplicate assets.

### R-15 — Storage quota failure has no online fallback

When enqueue fails, the operation remains optimistic but cannot sync. The app warns the user, yet there is no durable recovery path.

### R-16 — Remote reconciliation rewrites the full nested cache repeatedly

Like snapshots, deferred comments, status changes, and pagination each serialize all posts/comments/replies into `localStorage`. This increases quota pressure and makes transient remote state look authoritative.

### R-17 — User profile snapshots can become stale or untrusted

The in-memory `userCache` never expires. Remote documents also contain client-written `author` snapshots, while rules only verify `userId`, so a malicious client can submit misleading display data.

### R-18 — Pagination combines two independently limited streams

Each page may fetch up to 10 public and 10 private documents, then merge them. The cursor represents two streams, while the page’s UI reveals only two posts at a time. This is not necessarily incorrect, but behavior must be characterized before refactoring.

## P2 structure and maintenance risks

### R-19 — Three oversized modules own unrelated concerns

- `firestoreFeedService.js`: 926 lines.
- `useFeedData.js`: 542 lines.
- `useSyncQueueProcessor.js`: 462 lines.

File size is a symptom; split only after contracts/tests exist.

### R-20 — Presentation and persistence models are the same object

`displayTime`, nested comments, remote IDs, local paths, queue status, and Firestore fields are merged into one mutable graph.

### R-21 — Dead development data paths remain

`postService.js`, `userService.js`, static feed JSON, adapters, and seed-normalization helpers appear unused by the active route. Remove only after an import and build check in the cleanup phase.

### R-22 — No automated safety net exists

There are no unit, component, emulator-rules, or end-to-end tests. Refactoring before characterization would be unsafe.

## Risk-driven order

The work order is mandatory:

1. Add tests and observability.
2. Contain cross-account processing.
3. Make creates idempotent and stabilize IDs.
4. Stop forbidden/partial counter writes.
5. Introduce the repository boundary.
6. Enable and adopt Firestore persistent cache.
7. Replace the general queue with the media-only IndexedDB job store.
8. Migrate legacy local data safely.
9. Harden rules.
10. Remove legacy code and storage keys.


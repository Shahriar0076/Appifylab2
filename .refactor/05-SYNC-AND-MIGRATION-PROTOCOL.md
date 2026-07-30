# 05 — Sync and Migration Protocol

## General principle

There are two synchronization systems in the target:

1. Firestore’s built-in local write pipeline for Firestore documents.
2. A small explicit image-job state machine for Cloudinary uploads.

There is no general custom queue for posts, comments, replies, likes, or privacy.

## Firestore synchronization

### Write lifecycle

```text
command validates
  -> deterministic Firestore write
  -> local snapshot (hasPendingWrites=true)
  -> UI projection shows optimistic state
  -> Firebase retries internally
  -> server acknowledgement
  -> snapshot (hasPendingWrites=false)
```

The UI must subscribe with metadata changes enabled where pending status matters.

### Failure lifecycle

```text
command rejected immediately
  -> command result records failure
  -> UI keeps user input where possible
  -> existing error/retry surface is used

write accepted locally but rejected by rules/server
  -> subscription/command error is recorded against stable entity ID
  -> UI shows failed status
  -> retry repeats the same deterministic write after the cause is corrected
```

Never replace a rejected create with a new ID.

### Ordering

Use `clientCreatedAt` for immediate local ordering and `createdAt` server estimate/ack for final ordering. Sorting must be stable with `id` as the tie-breaker to prevent visible jumping.

### Reconciliation

Reconciliation key order for transitional readers:

1. v2 stable `id`;
2. Firestore document ID;
3. legacy `localId`;
4. legacy `remoteId`.

All matching lives in one pure module. Hooks and services must not implement ad hoc identity rules.

## Image upload state machine

### States

```text
pending
  -> uploading (lease acquired)
  -> upload receipt persisted
  -> Firestore image URL write
  -> acknowledged
  -> blob/job deleted

uploading
  -> retrying (retryable network/provider error)
  -> pending when nextAttemptAt is reached

uploading
  -> blocked (validation/auth/permanent provider error)

uploading with expired lease
  -> pending (claimed by a new worker)
```

### Lease requirements

Claim a job in one IndexedDB read-write transaction:

- job owner must equal active UID;
- status must be claimable;
- `nextAttemptAt <= now`;
- no unexpired lease may exist;
- write a random tab/worker ID and short `leaseUntil`.

Renew only while actively uploading. Release on handled failure. A crashed tab’s lease must expire.

### Retry policy

Use bounded exponential backoff with jitter. Persist `attempts` and `nextAttemptAt`; do not keep retry state only in `setTimeout`.

Classify:

- retryable: timeout, DNS/network, 408, 429, most 5xx;
- authentication/configuration/permanent: invalid preset, disallowed type, 400/401/403;
- ambiguous success: connection lost after request body was accepted.

For ambiguous success:

1. if a receipt already exists, do not upload again;
2. if the configured Cloudinary preset supports a deterministic public ID safely, reuse it;
3. otherwise mark the job for explicit recovery and document possible orphan asset risk.

Do not assume unsigned preset behavior; verify it outside production first.

### Cleanup

Delete the blob and job only after:

- an upload receipt is durable;
- the Firestore post contains that exact URL/public ID;
- the Firestore write is acknowledged.

If the post was deleted before upload, delete the local blob/job and record cleanup. If the authenticated UID changes, release the job and do not touch it.

## Legacy containment before cutover

Before adopting native Firestore persistence, patch the existing queue:

- introduce queue schema version 2;
- store one queue key per UID;
- add `ownerId`, `operationId`, and complete replayable payload;
- filter every read by the active UID;
- make unknown/malformed items quarantined, not “synced”;
- restore `syncing` items only after a stale threshold;
- cancel the processor on unmount;
- prevent a second in-tab processor;
- use deterministic Firestore paths for create operations;
- compact toggles/privacy by semantic key.

This is temporary scaffolding. It prevents data loss while the repository migration proceeds.

## Legacy ownership inference

Build a pure migration analyzer first. It returns a report and performs no writes:

```js
{
  assignable: [{ item, ownerId, reason }],
  ambiguous: [{ item, candidateOwnerIds, reason }],
  malformed: [{ rawItem, reason }],
  cacheIndex: { /* entity ID -> owner candidates */ }
}
```

Rules:

- an explicit payload actor UID is evidence;
- a comment/reply author UID is evidence;
- finding an entity ID in exactly one per-UID cache is evidence;
- the currently authenticated UID is not evidence;
- conflicting evidence makes the item ambiguous;
- ambiguous/malformed items are copied to a quarantine record before any queue rewrite.

Migration must be idempotent. Re-running it produces the same scoped queue and does not duplicate items.

## Feed-cache cutover

### Stage A — Dual-read comparison

- New repository reads Firestore snapshots.
- Legacy feed cache remains unchanged.
- In development/test, build both projections and compare stable fields.
- Log structured mismatches without changing what the user sees.

Compare:

- stable entity IDs/aliases;
- author ID/name;
- text/visibility/image URL;
- order;
- current-user liked state and count;
- comments/replies and their likes;
- pending/failed image state.

Ignore expected differences such as freshly calculated relative time.

### Stage B — New read path behind a flag

- Add `VITE_FEED_REPOSITORY_V2`.
- Default off until automated gates pass.
- When on, `FeedContext` retains its current external API but uses the new controller.
- Legacy cache is read only for migration/recovery, never merged continuously with live Firestore data.

### Stage C — New writes

- New commands use deterministic Firestore writes.
- Legacy queue becomes read-only drain/migration input.
- Do not allow the old and new writers to issue the same semantic operation.

### Stage D — Per-UID completion marker

Write a small versioned migration marker only after:

- all assignable legacy commands for that UID are acknowledged or represented in Firestore;
- all legacy image blobs are migrated or deliberately quarantined;
- the new Firestore projection passes parity checks;
- no ambiguous item is silently attributed.

Suggested key:

```text
buddyScript.feed.migration.v2.${encodedUid}
```

The marker contains version, timestamp, result counts, and app version; never sensitive content.

### Stage E — Legacy deletion

After the marker and at least one successful reload on the new path:

- remove only that UID’s legacy feed/version keys;
- remove only migrated queue items;
- retain quarantined raw data until the user/human chooses recovery or deletion;
- never call a global image clear.

## Rollback

Rollback is application-code based, not destructive:

- keep v1 readers during the observation window;
- new v2 writes retain fields readable by v1 mappers where feasible;
- feature flag can return presentation to the old reader before legacy deletion;
- once a UID’s legacy keys are deleted, rollback relies on Firestore and migrated image records, not recreation of the old nested cache.

Rules rollback must not reopen private data or restore forbidden counter writes.

## Observability

Development diagnostics should expose counts without content:

```js
{
  activeUid,
  firestoreFromCache,
  pendingFirestoreWrites,
  activePostSubscriptions,
  activeEngagementSubscriptions,
  mediaJobsByStatus,
  legacyAssignableCount,
  legacyQuarantineCount,
  lastMediaErrorCode
}
```

Never log post/comment text, emails, auth tokens, image blobs, Firebase config secrets, Cloudinary upload responses in full, or service credentials.


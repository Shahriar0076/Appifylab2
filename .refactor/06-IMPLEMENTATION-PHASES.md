# 06 — Implementation Phases

Each phase ends at a gate. Do not combine phases into one large change.

## Phase 0 — Freeze and characterize

### Goal

Create a safety net before changing persistence.

### Work

- Add Vitest and a `test` script.
- Add pure characterization fixtures for current post/comment/reply shapes.
- Test `feedFactories`, `feedMutations`, `feedPostIdentity`, `syncQueueService`, and current merge behavior.
- Add component tests for the `FeedContext` public contract and feed status rendering.
- Add Firebase emulator configuration and rules test harness, but do not change rules yet.
- Add a development-only diagnostics adapter that can be stubbed in tests.
- Capture visual baselines described in `09-UI-DESIGN-FREEZE.md`.

### Gate

- Existing behavior is represented, including known-bad behavior labeled as such.
- Lint/build pass.
- No source behavior changes other than testability/diagnostics.

## Phase 1 — Contain the legacy queue

### Goal

Stop cross-account processing and make pending commands recoverable.

### Work

- Add versioned queue-item validation.
- Add pure ownership analyzer for the global queue.
- Add per-UID queue keys and quarantine storage.
- Require `ownerId` and complete payload for all newly enqueued items.
- Pass current UID explicitly from `FeedContext` to actions and processor.
- Processor reads only its UID’s queue and verifies Firebase Auth still matches before every remote call and acknowledgement.
- Unknown items are quarantined.
- Add cancellation token/generation to stop old async loops after cleanup.
- Add single-tab in-process guard.
- Persist retry time instead of relying only on timers.
- Compact like/privacy commands by semantic target while preserving final intent.

### Do not

- Remove the queue.
- Enable Firestore persistence yet.
- Change UI markup or rules.

### Gate

Two-account, refresh, StrictMode, malformed-item, and quota-failure tests pass. No legacy item is silently deleted.

## Phase 2 — Stabilize identity and idempotency

### Goal

One entity ID survives local creation, retries, remote writes, and refresh.

### Work

- Introduce pure stable-ID and legacy-alias helpers.
- Update new post/comment/reply creation to send complete payloads with stable IDs.
- Replace `addDoc` create paths with `setDoc(doc(..., stableId), data)`.
- Make create replay safe.
- Update mappers and merge logic to match all legacy aliases through the central helper.
- Preserve reading mixed existing documents.
- Add deterministic sorting tie-breakers.

### Gate

Ack-loss/retry tests produce exactly one remote entity. Remote arrival cannot drop a pending dependent like/privacy/comment/reply command.

## Phase 3 — Align client writes with current rules

### Goal

Remove partial and forbidden counter updates before changing rules.

### Work

- Post/comment/reply creation writes only the entity.
- Comment/reply/post like commands create/delete deterministic like documents only.
- Remove client `increment` writes for `likesCount`, `commentsCount`, and `repliesCount`.
- Keep legacy counters readable as first-paint hints only.
- Live collection data overrides legacy counter hints after load.
- Ensure a failed secondary counter write can no longer make a successful entity look failed.

### Gate

Emulator tests prove non-owner comment, reply, and like flows work without partial documents. Collection-derived counts are correct in the UI.

## Phase 4 — Split pure domain and Firestore adapters

### Goal

Create stable seams while behavior remains on the legacy controller.

### Work

- Extract converters, collection constants, profile lookup, post queries, engagement queries, and command writers from `firestoreFeedService.js`.
- Extract pure merge/selectors from `useFeedData.js`.
- Keep compatibility exports so current hooks continue to work.
- Remove toast/React concerns from data modules.
- Add contract tests around the compatibility facade.

### Gate

`firestoreFeedService.js` is a thin compatibility facade or deleted after all imports move. Current feed behavior and visual tests remain unchanged.

## Phase 5 — Enable Firestore persistent local cache

### Goal

Make Firestore the durable offline store for Firestore-backed entities.

### Work

- Initialize Firestore once with persistent multi-tab cache using Firebase 12.16 supported APIs.
- Add tested memory fallback and persistence diagnostics.
- Convert reads that need optimistic/pending state to subscriptions with metadata changes.
- Add application repository/controller behind `VITE_FEED_REPOSITORY_V2`.
- Preserve pagination semantics and `FeedContext` API.
- Project snapshots into the existing nested UI shape.
- Keep legacy read path available behind the flag.

### Gate

Offline reload after a prior online load shows cached data. Offline Firestore writes appear immediately and later acknowledge without the legacy queue. Multi-tab tests pass.

## Phase 6 — Build the media-only IndexedDB subsystem

### Goal

Make image uploads durable, user-scoped, and independent from the nested feed graph.

### Work

- Add versioned `buddyScriptMedia` database.
- Add atomic blob + job transaction.
- Add owner-scoped queries, leases, persisted retry schedule, upload receipt, and cleanup.
- Wrap Cloudinary behind `MediaGateway`.
- Verify whether a deterministic Cloudinary public ID is supported by the configured unsigned preset in a non-production environment.
- Add worker integration with active UID and Firestore post update.
- Project image-job state to existing post image status fields.
- Migrate old `/uploads/...` blobs when ownership is provable.

### Gate

Offline image post survives reload; two workers upload once; auth switch cannot claim another user’s job; receipt recovery does not re-upload; successful acknowledgement deletes only the matching blob/job.

## Phase 7 — Switch commands and retire the general queue

### Goal

All Firestore mutations use the new repository; only image jobs use custom sync.

### Work

- Route create/comment/reply/likes/privacy through `feedCommands`.
- Use Firestore snapshots for optimistic state.
- Keep current action names exposed from `FeedContext`.
- Stop enqueuing new general queue items.
- Drain/migrate legacy scoped queues using `05-SYNC-AND-MIGRATION-PROTOCOL.md`.
- Enable v2 by default in development/test, then production only after approval.

### Gate

No new general queue entries appear. Full offline scenario matrix passes. Rollback flag remains functional before legacy cleanup.

## Phase 8 — Harden Firestore rules and indexes

### Goal

Rules express the same data contract as client validators and protect private child data.

### Work

- Implement the staged rules in `08-SECURITY-RULES-PLAN.md`.
- Add field allowlists, types, sizes, immutability, parent checks, and visibility checks.
- Remove client ability to mutate aggregate counters.
- Validate all active queries with the emulator.
- Remove only indexes proven unused after query inventory.

### Gate

Rules emulator matrix passes; every production query shape is covered; no deployment has occurred without explicit approval.

## Phase 9 — Per-UID cache migration and cleanup

### Goal

Remove obsolete local persistence after evidence that each UID is safe.

### Work

- Run dual-read parity in development/staging.
- Set per-UID completion markers only after all migration conditions pass.
- Remove that UID’s feed/version keys and migrated queue items.
- Retain quarantine.
- Remove legacy cache writes from application code.
- Remove obsolete queue/cache/image utilities after import search and tests.
- Remove confirmed dead static feed services/adapters/data in a separate cleanup commit.
- Update README architecture/schema documentation.

### Gate

No code reads/writes legacy keys; no pending user work was discarded; build/lint/tests/visuals pass; production cleanup requires explicit approval.

## Phase 10 — Final resilience and performance pass

### Goal

Validate operational quality after correctness.

### Work

- Measure listener count/read volume for 2, 10, and 50 loaded posts.
- Confirm subscriptions detach on pagination changes, account changes, and route unmount.
- Add cache/profile eviction policy.
- Inspect bundle splitting after modular Firestore imports.
- Test storage pressure and memory-fallback copy.
- Remove temporary compatibility facade and feature flag only after a defined observation window.

### Gate

All completion criteria in `00-START-HERE.md` pass and the checklist contains no unresolved P0/P1 item.


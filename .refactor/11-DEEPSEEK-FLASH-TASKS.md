# 11 — Bounded DeepSeek Flash Task Cards

Run exactly one card per agent turn/change set. Every card inherits `00-START-HERE.md`.

## DSF-00 — Install the safety net

### Read

`package.json`, `.oxlintrc.json`, current utilities under test, `07-TEST-AND-VERIFICATION-PLAN.md`.

### Prompt

> Add the Phase 0 unit-test foundation only. Configure Vitest and jsdom, add test scripts, and write characterization tests for `feedFactories`, `feedMutations`, `feedPostIdentity`, and `syncQueueService`. Do not change application behavior, Firebase rules, JSX, CSS, or visible copy. Label tests that capture known defects. Run focused tests, lint, build, and diff checks. Update the execution checklist and stop.

### Gate

Tests are deterministic and current application source behavior is unchanged.

## DSF-01 — Rules emulator baseline

### Read

`firestore.rules`, `firestore.indexes.json`, active Firestore queries/writes, `08-SECURITY-RULES-PLAN.md`.

### Prompt

> Add Firebase emulator configuration and rules-unit tests that characterize the current rules. Do not harden rules yet. Cover posts, comments, replies, and three like collections for unauthenticated, owner, and unrelated authenticated users. Include tests that demonstrate current private-child exposure and counter permission mismatch, clearly named as known defects. Do not deploy or run the seed script. Run tests/lint/build, update the checklist, and stop.

## DSF-02 — Analyze and scope the legacy queue

### Read

`syncQueueService.js`, `useFeedActions.js`, `useSyncQueueProcessor.js`, cache key logic in `useFeedData.js`, sections R-01/R-07 and legacy ownership protocol.

### Prompt

> Implement only a pure, read-only legacy queue analyzer and its fixtures. It must index UID-scoped feed caches, classify each global queue item as assignable, ambiguous, or malformed, and never use the active user as ownership evidence. It must not rewrite or delete storage yet. Add idempotent deterministic tests for conflicting and ambiguous ownership. Do not edit UI or remote services. Run gates, update checklist, and stop.

## DSF-03 — Introduce UID-scoped queue v2

### Read

DSF-02 output and Phase 1.

### Prompt

> Add versioned UID-scoped queue storage, validation, quarantine, and explicit write results. Migrate only items the analyzer can assign exactly; copy ambiguous/malformed raw items to quarantine. New items require ownerId, operationId, and replayable payload. Preserve v1 read compatibility. Do not change Firestore writes yet. Add account-switch and storage-failure tests. Run gates, update checklist, and stop.

## DSF-04 — Harden the temporary processor

### Read

`useSyncQueueProcessor.js`, scoped queue v2, R-05/R-08/R-11/R-12.

### Prompt

> Make the temporary processor owner-safe and lifecycle-safe. Require current Firebase UID to match each item before remote work and acknowledgement. Add cancellation generation, prevent concurrent in-tab loops, persist next retry time with jitter, restore only stale syncing items, and never report dependency failure as success. Unknown items must remain quarantined. Do not change JSX/CSS or replace the processor yet. Add StrictMode/unmount/account-switch/fake-timer tests. Run gates, update checklist, and stop.

## DSF-05 — Stable entity identity helpers

### Read

`feedFactories.js`, `feedPostIdentity.js`, remote normalizers, merges in `useFeedData.js`, R-02/R-04.

### Prompt

> Add pure stable ID and legacy alias helpers for posts, comments, and replies. Centralize matching and deterministic sorting. Update merge logic to use them while preserving current return shapes and all old documents. Do not change Firestore creation yet. Add remote-arrival-during-pending-operation fixtures, including comments and replies. Run gates, update checklist, and stop.

## DSF-06 — Idempotent Firestore creates

### Read

Creation functions in `firestoreFeedService.js`, queue payload creation, `04-DATA-AND-DATABASE-CONTRACTS.md`.

### Prompt

> Replace retryable `addDoc` creates for posts/comments/replies with deterministic `setDoc` paths using the existing stable client ID. Queue v2 create payloads must contain the complete immutable entity data needed for replay. Preserve reading v1 auto-ID documents. Do not change rules/counters/UI. Add ack-loss and duplicate-retry emulator tests proving one document per ID. Run gates, update checklist, and stop.

## DSF-07 — Remove browser counter writes

### Read

Comment/reply/like write functions, current rules tests, Phase 3.

### Prompt

> Stop browser code from updating likesCount, commentsCount, and repliesCount. Entity creation and deterministic like create/delete must be independent idempotent writes. Continue reading legacy counters only as initial hints; canonical loaded collection state overrides them. Update tests for non-owner interaction and partial-failure elimination. Do not harden rules yet or change UI structure. Run gates, update checklist, and stop.

## DSF-08 — Extract pure domain and converters

### Read

`firestoreFeedService.js`, `useFeedData.js`, `10-FILE-BY-FILE-MAP.md`.

### Prompt

> Extract only pure feed model/identity/merge/selectors and Firestore converters into the target folders. Keep compatibility exports so callers and UI do not change. No query, sync, rules, CSS, or copy behavior changes. Add converter tests for v1/v2/malformed/timestamp-estimate inputs. Stay within the change-size budget; split if required. Run gates, update checklist, and stop.

## DSF-09 — Split Firestore repositories

### Prompt

> Split profile, post, comment/reply, reaction, and feed-query responsibilities out of `firestoreFeedService.js` behind the same compatibility API. Data modules must not import React, toasts, localStorage, or UI state setters. Preserve exact query/pagination behavior. Add contract tests for public + own-private merge, pagination cursors, profile request deduplication, and listener cleanup. Do not enable persistent cache or change UI. Run gates, update checklist, and stop.

## DSF-10 — Initialize persistent Firestore cache

### Read

Installed Firebase 12.16 type declarations, config modules, Phase 5.

### Prompt

> Make `firebaseFirestore.js` the single Firestore initializer and enable the installed SDK’s supported persistent multi-tab local cache. Add an explicit tested memory fallback and a non-sensitive persistence diagnostic. Ensure emulator tests can configure the client before first use. Do not switch the feed controller yet. Prove offline cached read, pending local write metadata, reload, and multi-tab behavior with integration tests. Run gates, update checklist, and stop.

## DSF-11 — New feed repository/controller behind flag

### Prompt

> Implement a v2 feed repository/controller behind `VITE_FEED_REPOSITORY_V2`. Use Firestore subscriptions with metadata and pure selectors to produce the existing nested posts contract. Preserve the complete FeedContext public API, current public/private pagination behavior, two-at-a-time UI behavior, and listener cleanup. Legacy remains default. Add dual-projection comparison diagnostics without user content. Do not route writes to v2 yet. Run component/emulator/visual gates, update checklist, and stop.

## DSF-12 — Media database and job state machine

### Prompt

> Implement the owner-scoped IndexedDB media database with atomic blob+job creation, schema validation, leases, retry schedule, upload receipts, and cleanup rules. Use fake-indexeddb and a fake MediaGateway. Do not connect it to UI, Cloudinary, or legacy migration yet. Test two-worker claims, expired leases, account mismatch, every crash boundary, and quota rollback. Run gates, update checklist, and stop.

## DSF-13 — Cloudinary gateway and worker

### Prompt

> Wrap current Cloudinary upload in a validated abort-aware MediaGateway and connect the image worker to media jobs and deterministic Firestore post updates. Persist receipt before URL update; delete blob/job only after matching URL acknowledgement. Do not assume deterministic public IDs—record a blocked decision if the preset cannot be verified safely. Keep current UI image status projection. Use fakes for automated tests and do not call production Cloudinary. Run gates, update checklist, and stop.

## DSF-14 — Migrate legacy images

### Prompt

> Add a read-only analyzer and idempotent migrator for `buddyScriptImages/postImages`. Assign a blob only when its post path maps to exactly one UID-scoped cached post; otherwise quarantine metadata without deleting the blob. Migrate assignable blobs to the v2 atomic blob/job stores. Re-running must not duplicate jobs. Do not globally clear images. Run gates, update checklist, and stop.

## DSF-15 — Switch v2 commands

### Prompt

> Route v2 post/comment/reply/like/privacy commands through deterministic Firestore repository writes, and image posts through the media transaction. Firestore snapshots provide optimistic state; do not append to the general queue. Preserve existing FeedContext action names and UI return behavior. Legacy path remains behind the off flag. Test all online/offline/reload/account-switch scenarios and visuals. Run gates, update checklist, and stop.

## DSF-16 — Default v2 and drain legacy

### Prompt

> Default the v2 repository on in development/test. Stop all new v1 queue/cache writes. Migrate/drain only safely assigned legacy work, retain quarantine, and implement per-UID completion markers. Do not delete legacy keys yet. Prove rollback flag behavior and dual-projection parity. Run gates, update checklist, and stop for human review.

## DSF-17 — Harden rules

### Prompt

> Implement the tested staged Firestore rules contract: exact allowed fields, types/limits, immutable identity/parent/timestamps, owner-only post edits, no client counters, parent-chain checks for comments/replies/likes, and private-child protection. Preserve v1 reads and owners’ ability to delete legacy likes. Make real repository query shapes pass emulator tests. Do not deploy. Run all tests/lint/build, update checklist, and stop for security review.

## DSF-18 — Visual and resilience release gate

### Prompt

> Run the complete automated and manual release matrix with emulators and fake media. Capture the frozen screenshots at three viewports and compare them. Measure listener cleanup and check logs for secrets/content. Fix only scoped data-layer regressions; do not redesign. Record every command and unresolved issue. Stop for human go/no-go; do not deploy.

## DSF-19 — Legacy cleanup

### Prompt

> Only after human go-ahead and per-UID migration evidence, remove application reads/writes of legacy feed/version/global queue keys and migrated legacy image paths. Keep quarantine/recovery. Delete obsolete hooks/services/utilities only after import search, tests, lint, build, and diff review. Remove confirmed dead static feed code separately. Update README accurately. Do not deploy or delete production data. Run all gates, update checklist, and stop.


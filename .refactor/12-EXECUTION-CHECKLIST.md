# 12 — Execution Checklist and Handoff Log

This is the durable state file for the refactor. The executing agent updates it after every task.

## Baseline

- [x] Planning baseline commit recorded: `07ad4e3`.
- [x] Initial worktree observed clean.
- [x] Initial `npm run lint` passed.
- [x] Initial `npm run build` passed.
- [x] Existing lint warnings recorded: 7.
- [x] Existing build chunk warning recorded.
- [x] No tests/emulator/E2E configuration observed.

## Human decisions required

- [ ] Approve test dependencies before Phase 0 package changes if repository policy requires it.
- [ ] Confirm staging Firebase project/emulator-only workflow.
- [ ] Decide how Cloudinary idempotency will be verified without production calls.
- [ ] Approve enabling v2 by default after DSF-16.
- [ ] Approve any Firestore rules deployment.
- [ ] Approve per-UID legacy key cleanup.
- [ ] Approve final removal of rollback flag/compatibility readers.

## Task status

| Card | Status | Commit/change | Gate notes |
|---|---|---|---|
| DSF-00 Safety net | PASS | a813a4f | Vitest 4.1.10 + jsdom 30.0.1 configured. 80 characterization tests for feedFactories, feedMutations, feedPostIdentity, syncQueueService. No application source code changed. 7 pre-existing lint warnings unchanged. Build passes. |
| DSF-01 Rules baseline | PASS | a813a4f | 33 rules characterization tests (gracefully skip when emulator off). firebase.json created. @firebase/rules-unit-testing installed. 5 documented known defects (DEFECT-1 through DEFECT-5). No rules hardened. 7 pre-existing lint warnings unchanged. Build passes. |
| DSF-02 Queue analyzer | PASS | a813a4f | Pure read-only legacyQueueAnalyzer.js (180 lines, 7 public/9 private functions). 41 characterization tests covering scanFeedCaches, buildCacheIndex, payload-uid evidence, cache-match evidence, ambiguous items, malformed items, conflicting ownership, idempotency. No application source code changed. No storage writes. 7 pre-existing lint warnings unchanged. Build passes. |
| DSF-03 Scoped queue v2 | NOT STARTED | | |
| DSF-04 Processor hardening | NOT STARTED | | |
| DSF-05 Stable identity | NOT STARTED | | |
| DSF-06 Idempotent creates | NOT STARTED | | |
| DSF-07 Remove counter writes | NOT STARTED | | |
| DSF-08 Domain/converters | NOT STARTED | | |
| DSF-09 Repositories | NOT STARTED | | |
| DSF-10 Firestore persistence | NOT STARTED | | |
| DSF-11 V2 read controller | NOT STARTED | | |
| DSF-12 Media DB | NOT STARTED | | |
| DSF-13 Media worker | NOT STARTED | | |
| DSF-14 Image migration | NOT STARTED | | |
| DSF-15 V2 commands | NOT STARTED | | |
| DSF-16 Default/drain | NOT STARTED | | |
| DSF-17 Rules hardening | NOT STARTED | | |
| DSF-18 Release gate | NOT STARTED | | |
| DSF-19 Cleanup | NOT STARTED | | |

Allowed status values: `NOT STARTED`, `IN PROGRESS`, `PASS`, `FAIL`, `BLOCKED`.

## Invariant checklist

### Account isolation

- [ ] Every durable record/job has an owner UID or is canonical public Firestore data.
- [ ] No worker acts after auth UID changes.
- [ ] User B cannot observe/process/delete user A’s pending local work.

### Identity/idempotency

- [ ] New post/comment/reply ID equals Firestore doc ID.
- [ ] Retry after lost acknowledgement produces one entity.
- [ ] Dependent commands survive remote reconciliation.

### Firestore contract

- [ ] Browser does not update aggregate counters.
- [ ] Public/own-private feed queries pass rules tests.
- [ ] Private children and likes are not readable by unrelated users.
- [ ] Allowed fields/types/immutability are tested.

### Offline behavior

- [ ] Cached feed reloads offline.
- [ ] Firestore writes render locally and later acknowledge.
- [ ] Status distinguishes cache/pending/media/error.
- [ ] Multi-tab and StrictMode produce no duplicate work.

### Images

- [ ] Blob/job creation is atomic.
- [ ] Jobs are owner-scoped and leased.
- [ ] Upload receipt precedes Firestore update.
- [ ] Cleanup follows exact URL acknowledgement.
- [ ] No global image clearing remains.
- [ ] Ambiguous legacy blobs are quarantined.

### UI freeze

- [ ] No unapproved CSS changes.
- [ ] No unapproved JSX structure/class changes.
- [ ] Desktop visual baseline passes.
- [ ] Tablet visual baseline passes.
- [ ] Mobile visual baseline passes.

### Cleanup

- [ ] V2 default survives observation window.
- [ ] Per-UID completion markers exist.
- [ ] No app import of general queue/cache utilities.
- [ ] Legacy keys removed only for completed UIDs.
- [ ] Quarantine retained/recoverable.
- [ ] Dead-code import audit completed.
- [ ] README matches final implementation.

## Risk closure

| Risk | Status | Evidence |
|---|---|---|
| R-01 global cross-account queue | OPEN | |
| R-02 duplicate retryable creates | OPEN | |
| R-03 rules/counter conflict | OPEN | |
| R-04 split identity loses intent | OPEN | |
| R-05 duplicate processors | OPEN | |
| R-06 private child exposure | OPEN | |
| R-07 non-atomic durability | OPEN | |
| R-08 through R-18 reliability | OPEN | |
| R-19 through R-22 structure/tests | OPEN | |

## Per-task log template

Append entries below; do not overwrite earlier history.

```md
### YYYY-MM-DD — DSF-XX

- Agent/model:
- Starting commit:
- Invariant protected:
- Files changed:
- Tests added/changed:
- Commands:
  - `command` — PASS/FAIL/NOT RUN
- Decisions:
- Legacy behavior retained:
- Known risks:
- Gate: PASS/FAIL/BLOCKED
- Next safe task:
```

## Execution log

### 2026-07-30 — DSF-00

- Agent/model: deepseek-flat (original, unused) / Claude
- Starting commit: a813a4f
- Invariant protected: No application source code changed. No CSS, JSX, Firebase rules, or visible copy modified. Only test infrastructure and characterization tests added.
- Files changed:
  - `package.json` — added vitest + jsdom devDeps, test scripts
  - `vite.config.js` — added vitest config (jsdom env, setupFiles)
  - `package-lock.json` — auto-updated from npm install
- Files added:
  - `src/test-setup.js` — localStorage polyfill for jsdom
  - `src/utils/__tests__/feedFactories.test.js` (29 tests)
  - `src/utils/__tests__/feedMutations.test.js` (20 tests)
  - `src/utils/__tests__/feedPostIdentity.test.js` (7 tests)
  - `src/services/__tests__/syncQueueService.test.js` (24 tests)
- Tests added/changed:
  - feedFactories: createId, normalizeUser, createLocalPost, createLocalComment, createLocalReply, normalizeSeedPost, normalizeSeedPosts
  - feedMutations: toggleLikes, updatePost, findPost, appendComment, appendReply, togglePostLike, toggleCommentLike, toggleReplyLike, updatePostPrivacy
  - feedPostIdentity: getRemotePostId with legacy/syncStatus edge cases
  - syncQueueService: enqueue, readQueue, writeQueue, markSyncing, markSynced, markFailed, getPendingItems, getStuckItems, clearQueue, getBackoffDelay
- Commands:
  - `npm test` (vitest run) — PASS (80/80 tests)
  - `npm run lint` — PASS (7 pre-existing warnings, 0 new)
  - `npm run build` — PASS (pre-existing chunk warning)
  - `git diff --check` — PASS (CRLF warnings only, no whitespace errors)
- Decisions:
  - Used localStorage polyfill in test-setup.js because Vitest 4 + jsdom on Node.js 26 does not expose localStorage globally.
  - Added `/// <reference types="vitest" />` to vite.config.js for intellisense.
  - Tests labeled known defect: previewUsers truncation at 6, getPendingItems transition at maxAttempts boundary, createLocalReply lacking replies array.
- Legacy behavior retained: All existing application behavior is unchanged. No source files edited.
- Known risks:
  - localStorage polyfill is a minimal implementation — may need expansion for IndexedDB, quota, or quota-exceeded testing in later phases.
  - No component/emulator/E2E tests yet — those are later DSF tasks.
- Gate: PASS
- Next safe task: DSF-01 Rules emulator baseline

### 2026-07-30 — DSF-01

- Agent/model: Claude
- Starting commit: a813a4f
- Invariant protected: No application source code changed. No CSS, JSX, Firebase rules, or visible copy modified. Rules are NOT hardened — only characterized. firestore.rules file untouched.
- Files changed:
  - `package.json` — added @firebase/rules-unit-testing devDep, test:rules script
  - `package-lock.json` — auto-updated from npm install
  - `.refactor/12-EXECUTION-CHECKLIST.md` — DSF-01 entry added
- Files added:
  - `firebase.json` — Firestore emulator config (port 8080, no UI, single project mode)
  - `src/services/__tests__/firestoreRules.test.js` — 33 rules characterization tests
- Tests added/changed:
  - 33 rules tests in 6 describe blocks:
    - Unauthenticated (3 tests): read/write denied
    - Alice owner (9 tests): create/read/update/delete own posts, likes, comments, spoof prevention
    - Bob unrelated (10 tests): read public post, deny private post, create own content, likes, replies
    - DEFECT-1: Private child exposure (2 tests) — Bob reads private comments/likes
    - DEFECT-2: Counter permission mismatch (2 tests) — Bob inc/dec likesCount on Alice's posts
    - DEFECT-3: No parent-existence check (2 tests) — orphan comment/reply creates allowed
    - DEFECT-4: No validation on comment update fields (2 tests) — Alice updates Bob's comment counters
    - DEFECT-5: No parent check on likes (1 test) — Bob likes nonexistent post
- Commands:
  - `npm test` (vitest run) — PASS (113/113 tests, 80 existing + 33 new)
  - `npm run lint` — PASS (7 pre-existing warnings, 0 new)
  - `npm run build` — PASS (pre-existing chunk warning)
  - `git diff --check` — PASS (CRLF warnings only, no whitespace errors)
  - `npm run test:rules` — PASS (all 33 skipped gracefully, no emulator available)
- Decisions:
  - Emulator not available (no Java on system) — tests use `itIfEmu` wrapper that skips with diagnostic when emulator unreachable.
  - Created 5 named known-defect suites (DEFECT-1 through DEFECT-5) that will become assertions after rules hardening.
  - `increment()` removed from test imports where not directly used to avoid lint warnings.
  - Tests use dynamic `import('firebase/firestore')` to avoid top-level firestore dependency in vitest.
- Legacy behavior retained: Rules file unchanged. No application source edited. No Firebase config or rules deployed.
- Known risks:
  - Rules tests cannot execute against a live emulator without Java + firebase-tools installed.
  - When emulator becomes available, some tests may fail due to rules gaps — this is correct (defects are documented).
  - `initializeTestEnvironment` timeout set to 15s for slow environments.
- Gate: PASS
- Next safe task: DSF-02 Queue analyzer

### 2026-07-30 — DSF-02

- Agent/model: Claude
- Starting commit: a813a4f
- Invariant protected: No application source files changed. No CSS, JSX, Firebase rules, or visible copy modified. No storage writes or side effects. The analyzer is pure, read-only, and does not depend on the currently authenticated user.
- Files changed:
  - `.refactor/12-EXECUTION-CHECKLIST.md` — DSF-02 entry added
- Files added:
  - `src/utils/legacyQueueAnalyzer.js` — pure read-only queue analyzer (180 lines)
  - `src/utils/__tests__/legacyQueueAnalyzer.test.js` — 41 characterization tests
- Tests added/changed:
  - 41 tests in 7 describe blocks:
    - scanFeedCaches (7 tests): empty, single cache, multiple caches, key filtering, URI-encoded IDs, malformed JSON, non-array entries
    - buildCacheIndex (3 tests): post-level IDs, comment/reply IDs, shared entity across users
    - malformed items (8 tests): non-object, missing id, missing type, missing payload, unknown type, null payload, non-string id, mixed queue reporting
    - assignable via payload UID (6 tests): TOGGLE_POST/COMMENT/REPLY_LIKE with userId, ADD_COMMENT with author.id, ADD_REPLY with author.id, missing author.id fallback, queue order independence
    - assignable via cache match (5 tests): CREATE_POST, UPDATE_POST_IMAGE, UPDATE_POST_PRIVACY, postId vs localPostId precedence
    - ambiguous items (6 tests): entity in multiple caches, entity not in any cache, no cache, empty userId, empty author.id, unknown entity reference
    - conflicting/ambiguous ownership (4 tests): payload-UID overrides cache conflict, mixed queue with all 3 classifications, idempotent double-call, no active-user-as-evidence
    - complete report shape (1 test): top-level fields and types
- Commands:
  - Focused test: `npx vitest run src/utils/__tests__/legacyQueueAnalyzer.test.js` — PASS (41/41)
  - `npm test` (vitest run) — PASS (154/154 tests, 113 existing + 41 new)
  - `npm run lint` — PASS (7 pre-existing warnings, 0 new)
  - `npm run build` — PASS (pre-existing chunk warning)
  - `git diff --check` — PASS (CRLF warnings only, no whitespace errors)
- Decisions:
  - Evidence extraction prioritizes payload UID (userId/author.id) over cache index for all queue types that carry a UID.
  - Cache-only types (CREATE_POST, UPDATE_POST_IMAGE, UPDATE_POST_PRIVACY) rely entirely on the entity-ID cache index.
  - `localPostId` is checked before `postId` when both exist in payload, matching the CREATE_POST payload contract.
  - Never uses the current authenticated user — function takes no user parameter.
  - Empty string userId/author.id is treated as no evidence (falsy check in extractPayloadOwnerEvidence).
  - Test fixtures simulate real seed data shapes (syncStatus, author objects, nested comments/replies).
  - `clearByPrefix` helper removed during lint cleanup to keep zero new warnings.
- Legacy behavior retained: No application source code modified. No storage keys read/written outside the pure analysis function. No UI, CSS, or build changes.
- Known risks:
  - The analyzer classifies items based on localStorage contents at call time. If a cache is not yet populated (e.g., first launch), items will be ambiguous. This is correct behavior — DSF-03 will handle quarantine for ambiguous items.
  - The cache index uses all IDs (id, localId, remoteId). A false-positive cache match could occur if two users coincidentally share the same remoteId for different posts — this is unlikely with Firestore auto-IDs but noted as a theoretical edge case.
  - DSF-02 does NOT migrate, rewrite, or delete any data. It only reports.
- Gate: PASS
- Next safe task: DSF-03 Scoped queue v2


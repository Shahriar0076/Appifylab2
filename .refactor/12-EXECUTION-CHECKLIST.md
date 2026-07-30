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
| DSF-00 Safety net | NOT STARTED | | |
| DSF-01 Rules baseline | NOT STARTED | | |
| DSF-02 Queue analyzer | NOT STARTED | | |
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

No implementation task has started.


# 07 — Test and Verification Plan

## Test layers

### Unit tests

Use Vitest for:

- stable ID generation and legacy alias matching;
- v1/v2 Firestore converters;
- entity validation;
- deterministic merges and stable ordering;
- queue schema validation, ownership inference, quarantine, and compaction;
- retry classification/backoff with fake timers;
- image-job state transitions and lease rules;
- UI projection selectors;
- status-model projection.

Tests must not need real Firebase, Cloudinary, browser storage, or network.

### Component tests

Use React Testing Library with `jsdom` for:

- `FeedContext` facade shape;
- cached/loading/error/status states;
- post creation input retention on failure;
- stable handler behavior;
- post/comment/reply optimistic rendering;
- like state and count;
- privacy controls only for owner;
- image preview and retry surfaces;
- no markup/class changes in frozen components.

Use `fake-indexeddb` for browser database tests.

### Firestore emulator and rules tests

Use Firebase Emulator Suite and `@firebase/rules-unit-testing`.

Required identities:

- unauthenticated;
- Alice (post owner);
- Bob (unrelated authenticated user);
- Charlie (comment author where needed).

Required matrix:

| Operation | Public parent | Private parent owned | Private parent unrelated |
|---|---:|---:|---:|
| read post | allow auth | allow owner | deny |
| create post as self | allow | allow | n/a |
| spoof `userId`/author/immutable fields | deny | deny | deny |
| change visibility as owner | allow | allow | deny |
| update counters from client | deny | deny | deny |
| read comments/replies | allow auth | allow owner | deny |
| create comment on readable post | allow | allow owner | deny |
| reply to valid readable comment | allow | allow owner | deny |
| create mismatched reply parent chain | deny | deny | deny |
| create/delete own like | allow | allow owner | deny |
| create/delete another UID’s like | deny | deny | deny |
| update like document | deny | deny | deny |

Every query used by `feedQuery`, comment, reply, and reaction repositories needs an emulator integration test, not only individual-document rules tests.

### End-to-end tests

Use Playwright against local Vite plus Firebase emulators. Stub the media gateway for deterministic upload results; keep one optional non-production provider contract test separate.

Core flows:

1. register/login/logout/protected route;
2. initial feed load and two-at-a-time reveal;
3. create text post online;
4. create image post online;
5. create text and image posts offline, reload offline, reconnect;
6. comment/reply/like/unlike/privacy offline then reconnect;
7. rapid repeated like and privacy toggles;
8. account switch with pending work;
9. two tabs observing and writing;
10. crash/reload while Firestore write is pending;
11. crash/reload at each image job state;
12. private content inaccessible to unrelated user;
13. pagination with mixed public and own-private posts;
14. legacy cache/queue migration and quarantine.

## Failure injection matrix

Provide test adapters/fakes that can fail at exact boundaries:

- before local Firestore write;
- after local snapshot but before remote acknowledgement;
- remote success with lost acknowledgement;
- rules denial;
- IndexedDB open/transaction/quota error;
- after blob stored but before job creation attempt (transaction must roll back);
- after upload success but before receipt persistence;
- after receipt persistence but before Firestore URL update;
- after URL local write but before acknowledgement;
- worker lease expiry;
- tab unmount/account change during work;
- Cloudinary 400, 401, 403, 408, 429, 500, timeout, malformed success JSON.

## Legacy migration fixtures

Build fixtures for:

- valid feed cache version 3;
- corrupt JSON;
- wrong cache version;
- global queue with explicit actor UID;
- create-post item resolved only through a UID cache;
- same entity ID appearing in two UID caches;
- payload actor conflicting with cached owner;
- stuck `syncing` item;
- attempts at/over maximum;
- unknown type;
- missing payload fields;
- legacy local image present/missing;
- a remote document already created before migration;
- migration run twice.

Expected outcome for every item must be one of:

- safely assigned;
- already represented remotely;
- quarantined;
- invalid and retained for diagnostics.

No fixture outcome is “silently delete.”

## Visual regression

Capture baseline and post-refactor screenshots at:

- desktop: 1440 × 900;
- tablet: 768 × 1024;
- mobile: 390 × 844.

States:

- auth route loader;
- feed skeleton;
- normal feed with text and image posts;
- composer image preview;
- public/private controls;
- comments hidden/expanded and reply form;
- liked/unliked;
- offline banner;
- pending Firestore write;
- image uploading;
- failed/retry status;
- storage/persistence warning;
- load-more spinner.

Mask only inherently dynamic relative time and generated object URLs. Do not update baselines automatically.

## Manual exploratory matrix

Run with browser DevTools:

- Network offline/online;
- slow 3G;
- disabled IndexedDB;
- storage quota pressure;
- two tabs;
- private/incognito session;
- hard reload during each pending state;
- clock skew forward/back;
- logout/login another seed account;
- Cloudinary misconfigured in a non-production environment.

Check:

- no duplicate visible or remote entity;
- no lost input;
- no cross-account work;
- no endless “Saving…”;
- no success toast after failure;
- no private child content;
- status copy clears when resolved;
- local image is released only at the correct time.

## Baseline commands

Add scripts over Phase 0, then standardize on:

```text
npm run test
npm run test:rules
npm run test:e2e
npm run lint
npm run build
git diff --check
```

When packages/scripts do not exist yet, Phase 0 must add them before later cards claim verification.

## Acceptance thresholds

- Zero unresolved P0/P1 test failures.
- Zero new lint warnings.
- Production build succeeds.
- Visual snapshots have no unapproved difference.
- All emulator rules tests pass.
- No duplicate documents in idempotency tests.
- No active listener/worker after unmount or UID change.
- No legacy item deletion without a migration classification.
- No secret or user content appears in logs/snapshots.


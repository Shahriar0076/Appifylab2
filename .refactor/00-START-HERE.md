# 00 — Start Here: DeepSeek Flash Agent Contract

## Mission

Refactor the offline feed and Firebase backend incrementally so synchronization is correct across refreshes, offline periods, retries, multiple tabs, and account switches. Preserve the existing product design and behavior.

Do not perform a broad rewrite. Complete one task from `11-DEEPSEEK-FLASH-TASKS.md` at a time, satisfy its gate, record the result in `12-EXECUTION-CHECKLIST.md`, and stop.

## Non-negotiable rules

1. Never read, print, copy, commit, or modify `.env.local` or `scripts/service-account.json`.
2. Never run `scripts/seed.mjs` against a real project as part of the refactor.
3. Never deploy Firestore rules, indexes, Cloud Functions, hosting, or application builds without explicit human authorization.
4. Do not edit `src/assets/css/*`, Bootstrap, fonts, images, or visible copy during backend phases.
5. Do not change the JSX hierarchy or existing CSS class names in `FeedPage`, `PostComposer`, `FeedPost`, `CommentThread`, `CommentItem`, `ReactionSummary`, `ReactionBar`, `PrivacyToggle`, or `Header` until visual parity tests exist and pass.
6. Do not delete legacy local data merely because it cannot be parsed. Quarantine it and expose a recoverable diagnostic.
7. Do not process a mutation whose owner cannot be proven to equal the current Firebase UID.
8. Do not use `addDoc` for retryable post, comment, or reply creation. A retryable create must use a deterministic document path and idempotent `setDoc`.
9. Do not make UI state durable in one operation and its outgoing mutation durable in a second unrelated operation. Either Firestore owns both through its local cache, or an IndexedDB transaction owns both.
10. Do not rely on `navigator.onLine` as proof that Firebase or Cloudinary is reachable.
11. Never weaken security rules to make a client test pass. Fix the client/rule contract.
12. Every behavior change needs a test that fails before the change and passes after it.

## Required operating loop for every task

1. Read the task card and only the linked plan sections.
2. Inspect the current versions of every source file named by the card.
3. Check `git status --short`. Preserve unrelated changes.
4. State the exact invariant being protected in the task notes.
5. Add or update the smallest characterization test first.
6. Make the smallest implementation change that satisfies the card.
7. Run the card’s focused tests.
8. Run `npm run lint` and `npm run build`.
9. Review `git diff --check` and the actual diff. Reject accidental CSS, markup, copy, lockfile, generated `dist`, or secret changes.
10. Update `12-EXECUTION-CHECKLIST.md` with commands, results, decisions, and remaining risks.
11. Stop at the gate. Do not automatically begin the next card.

## Required response format after each card

Use this compact handoff:

```text
Task:
Invariant protected:
Files changed:
Tests added/changed:
Commands and results:
Legacy behavior retained:
Known risks:
Gate: PASS | FAIL
Next safe task:
```

Do not claim a pass if a command was skipped. Write `NOT RUN` and explain why.

## Change-size budget

A DeepSeek Flash agent should keep each task reviewable:

- Prefer at most 6 application files plus focused tests per task.
- Prefer less than 400 changed lines excluding generated snapshots and lockfile changes.
- If a task exceeds either budget, split it at a stable interface and update the checklist.
- Never mix rule changes, schema migration, UI changes, and cleanup in one task.

## Stop conditions

Stop and request human direction if:

- current code materially differs from commit `07ad4e3` in a file the task depends on;
- a legacy queue item cannot be assigned to exactly one UID;
- a proposed rules query fails because Firestore cannot prove it is authorized;
- emulator behavior differs from the assumed offline or pending-write model;
- Cloudinary cannot provide the required upload idempotency and an infrastructure choice is required;
- the migration would discard a pending post, comment, reply, like, privacy update, or image;
- a task requires deploying or changing production data;
- UI screenshots differ outside explicitly approved sync-status behavior.

## Definition of complete

The refactor is complete only when:

- all task gates in `12-EXECUTION-CHECKLIST.md` pass;
- legacy and new local states have tested migration paths;
- two-user, offline, refresh, retry, crash, and multi-tab scenarios pass;
- Firestore emulator rules tests pass;
- no application code reads `buddyScript.feed.posts.*`, `buddyScript.feed.version.*`, or `buddyScript.feed.syncQueue`;
- legacy keys are removed only after a successful, recorded cutover for that UID;
- old remote documents remain readable;
- visual baselines pass at desktop, tablet, and mobile sizes;
- lint and production build pass without adding warnings;
- source modules have clear ownership and the obsolete files listed in the cleanup phase are removed.


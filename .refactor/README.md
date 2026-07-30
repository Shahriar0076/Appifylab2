# Buddy Script Refactor Plan

This directory is the execution package for refactoring the feed persistence and Firebase integration without changing the product design or losing pending user work.

The plan was written against commit `07ad4e3` on branch `refactor` on 2026-07-30. Before executing a phase, compare the current commit with that baseline and re-audit any changed files named by that phase.

For the easiest execution workflow, copy the single reusable prompt from
[`COPY-PASTE-INTO-PI.md`](./COPY-PASTE-INTO-PI.md) into Pi. Reuse the same
prompt after each completed task.

## Outcome

The intended end state is:

- React components keep their present markup, CSS class names, responsive behavior, copy, and user interactions.
- Firestore plus its persistent local cache owns posts, comments, replies, likes, privacy changes, and their offline write queue.
- Custom IndexedDB owns only local image blobs and durable image-upload jobs.
- `localStorage` no longer stores a complete nested feed or a global mutation queue.
- Post, comment, and reply IDs are generated once on the client and used as Firestore document IDs, making retries idempotent.
- Every local artifact and background job is scoped to the authenticated Firebase UID.
- Firestore rules, data access code, and tests agree on privacy, ownership, allowed fields, and parent relationships.
- The current top-level Firestore collections remain in place during this refactor. A collection-path migration is intentionally out of scope because it would add risk without solving the current synchronization defects.

## Files in execution order

1. [`00-START-HERE.md`](./00-START-HERE.md) — agent contract and operating loop.
2. [`01-CURRENT-SYSTEM-AUDIT.md`](./01-CURRENT-SYSTEM-AUDIT.md) — what exists now and how data moves.
3. [`02-RISK-REGISTER.md`](./02-RISK-REGISTER.md) — defects and regression hazards that drive the sequence.
4. [`03-TARGET-ARCHITECTURE.md`](./03-TARGET-ARCHITECTURE.md) — final module and ownership design.
5. [`04-DATA-AND-DATABASE-CONTRACTS.md`](./04-DATA-AND-DATABASE-CONTRACTS.md) — UI, local, and Firestore data shapes.
6. [`05-SYNC-AND-MIGRATION-PROTOCOL.md`](./05-SYNC-AND-MIGRATION-PROTOCOL.md) — synchronization state machines and legacy-data cutover.
7. [`06-IMPLEMENTATION-PHASES.md`](./06-IMPLEMENTATION-PHASES.md) — ordered implementation phases and gates.
8. [`07-TEST-AND-VERIFICATION-PLAN.md`](./07-TEST-AND-VERIFICATION-PLAN.md) — automated, emulator, manual, and visual checks.
9. [`08-SECURITY-RULES-PLAN.md`](./08-SECURITY-RULES-PLAN.md) — rules defects and staged hardening.
10. [`09-UI-DESIGN-FREEZE.md`](./09-UI-DESIGN-FREEZE.md) — presentation invariants.
11. [`10-FILE-BY-FILE-MAP.md`](./10-FILE-BY-FILE-MAP.md) — current-to-target source map.
12. [`11-DEEPSEEK-FLASH-TASKS.md`](./11-DEEPSEEK-FLASH-TASKS.md) — bounded prompts for a small/fast coding agent.
13. [`12-EXECUTION-CHECKLIST.md`](./12-EXECUTION-CHECKLIST.md) — durable progress and handoff record.

## Baseline observed before planning

- `npm run lint`: exit `0`, with seven pre-existing warnings.
- `npm run build`: exit `0`, with a pre-existing chunk-size warning.
- There is no test script, test framework, Firebase emulator configuration, or end-to-end test configuration.
- The Git worktree was clean.
- `.refactor` existed and was empty.

## Scope boundary

This package is a plan only. It does not deploy Firebase rules, mutate Firestore data, run the seed script, change application source, add packages, or change the UI.

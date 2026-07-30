# 08 — Firestore Security Rules Plan

## Current gaps

1. User documents have no allowed-key, type, length, or immutable-email checks.
2. Post creates verify only `userId`; arbitrary fields and spoofed author snapshots are accepted.
3. Post owners can update every field, including ownership/creation metadata/counters.
4. Any authenticated user can read every comment, reply, and like document, including children of private posts.
5. Comment/reply creates do not verify that the parent exists, is readable, or matches the supplied parent chain.
6. Comment/reply owners can update every field, including parent IDs and counters.
7. Counter permissions do not match client behavior and are insecure/fragile.
8. Like rules verify actor ownership but not referenced parent existence/access or exact allowed fields.

## Rules design principles

- Rules validate shape and authorization; client validators are convenience only.
- Rules are not filters. Every query must make its authorized result set provable.
- Identity, parent references, creation timestamps, and schema version are immutable.
- Browser clients cannot update aggregate counters.
- Child visibility follows the parent post.
- Like documents are exact create/delete records owned by the authenticated UID.
- Old schema v1 documents remain readable, but new writes must meet v2 validation.
- Do not deploy rule changes until emulator query tests pass.

## Helper concepts

Implement small, testable helpers for:

- `signedIn()`;
- `isSelf(uid)`;
- `post(pathId)` / parent lookup;
- `canReadPostData(postData)`;
- `canReadPost(postId)`;
- exact allowed keys for create/update;
- valid short string/text/color/visibility/timestamp;
- unchanged immutable fields;
- like document ID convention for v2 plus legacy delete compatibility.

Keep rule access-call limits in mind. Queries batch at most 10 parent IDs today; emulator tests must prove the exact query shapes work within limits.

## Collection policy

### Users

- Read: authenticated users, matching current product behavior.
- Create: document ID equals auth UID; exact allowed keys; valid field types and lengths.
- Update: self; only approved profile fields and `updatedAt`; email/createdAt/schema identity immutable unless a separately approved flow exists.
- Delete: self if account-deletion product flow still requires it.

### Posts

- Read: authenticated and (`visibility == public` or `userId == auth.uid`).
- Create: signed in, `userId == auth.uid`, deterministic ID accepted, exact v2 fields/valid types, no client-controlled counters beyond a constrained legacy-compatible initial zero if temporarily required.
- Update: owner; only `text`, `visibility`, approved image fields, and `updatedAt`; identity, owner, schema version, and created timestamps immutable.
- Delete: owner.
- Non-owners cannot update counters.

### Comments

- Read: caller can read referenced post.
- Create: `userId == auth.uid`, parent post exists/readable, exact fields, text valid.
- Update: author and only editable text/updatedAt if editing is a supported feature; otherwise deny update.
- Delete: author, with orphan cleanup handled as a separate trusted process if needed.
- Parent IDs, user ID, timestamps, and counters immutable.

### Replies

- Read: caller can read referenced post.
- Create: actor is self; referenced comment exists; comment’s `postId` matches supplied `postId`; caller can read parent post.
- Update/delete: same restricted author policy as comments.

### Likes

- Read: caller can read the referenced post chain.
- Create:
  - actor UID matches data UID;
  - v2 doc ID matches deterministic encoding;
  - exact allowed keys;
  - target and parent chain exist/match;
  - caller can read the parent post.
- Delete: resource UID equals actor UID; legacy like IDs may remain deletable by their owner.
- Update: always deny.

## Query compatibility work

Before rules edits, inventory exact active query shapes:

- public posts by visibility + createdAt;
- own private posts by userId + visibility + createdAt;
- comments by postId `in` + createdAt;
- replies by commentId `in` + createdAt;
- three like collections by target ID `in`;
- user profile document reads.

For each:

1. create authorized and unauthorized emulator data;
2. run the real repository query;
3. verify allow/deny and expected results;
4. record required indexes;
5. reduce `in` batch size if rule access-call limits require it.

Do not guess that a document-read rule automatically permits the corresponding collection query.

## Rollout sequence

1. Add rules tests for current rules and mark exposed behavior.
2. Stop forbidden client counter updates.
3. Add v2 create validation while retaining v1 reads.
4. Restrict update fields/immutability.
5. Add parent checks to comments/replies/likes and adjust query batching if needed.
6. Verify all application and seed/emulator fixtures.
7. Review rule diff manually.
8. Deploy to an emulator/staging Firebase project only with human authorization.
9. Run end-to-end smoke tests.
10. Production deployment is a separate explicit action with rollback rules prepared.

## Seed script impact

The seed script currently uses admin privileges and bypasses client rules. Update its generated shapes to v2 only after application readers support both versions. Never use admin seeding as proof that client rules work.


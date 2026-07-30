# 10 — File-by-File Refactor Map

This map describes intended ownership. It is not permission to move everything in one commit.

## Keep largely unchanged

| Current path | Target treatment |
|---|---|
| `src/pages/LoginPage.jsx` | Keep; auth refactor is not the primary scope. |
| `src/pages/RegistrationPage.jsx` | Keep; adjust only if v2 user validation requires fields. |
| `src/pages/FeedPage.jsx` | Keep public context usage and rendered structure. |
| `src/components/feed/*` | Keep markup/classes/behavior; accept projected v2 data through current props. |
| `src/components/common/*` | Keep. |
| `src/components/icons/*` | Keep. |
| `src/assets/*` | Freeze. |
| `src/utils/feedValidation.js` | Keep UI validation; share constants with domain validation if clean. |
| `src/utils/imageValidation.js` | Keep. |
| `src/utils/resizeImageToJpeg.js` | Keep behind media input boundary. |
| `src/utils/formatRelativeTime.js` | Keep as presentation selector helper. |
| `src/utils/toast.js` | Keep at presentation/application boundary, never use in repositories. |

## Refactor behind compatibility facades

### `src/context/FeedContext.jsx`

Current: composes four hooks and exposes data/actions.

Target:

- remains the UI facade;
- obtains state/actions from `useFeedController`;
- maps structured status to existing string/boolean fields;
- passes active UID into all account-owned systems;
- contains no persistence implementation.

### `src/hooks/useFeedData.js`

Current: cache I/O, post state, subscriptions, merge, fetch, pagination, reset.

Extract in order:

1. pure sort/identity/merge to `src/domain/feed`;
2. Firestore queries/subscriptions to repositories;
3. controller state to `src/features/feed/feedController.js`;
4. legacy cache reader to `src/migrations/legacyFeedCache.js`.

Delete after Phase 9.

### `src/hooks/useFeedActions.js`

Current: validation, object creation, IDB blob write, optimistic mutation, queue enqueue, retry.

Extract:

- domain factories/IDs;
- command methods to `src/features/feed/feedCommands.js`;
- image creation transaction to media repository;
- legacy queue actions remain temporarily in a compatibility adapter.

Delete after Phase 7/9.

### `src/hooks/useSyncQueueProcessor.js`

Current: general command switch, timers, Cloudinary, Firestore, React mutation.

Temporary Phase 1: harden with UID scope/cancellation/idempotency.

Target:

- remove general processor after Firestore native writes take over;
- media behavior becomes `src/features/media/imageUploadWorker.js`;
- no worker touches React posts directly.

Delete after Phase 9.

### `src/services/firestoreFeedService.js`

Split into:

```text
src/data/firestore/converters.js
src/data/firestore/profileRepository.js
src/data/firestore/postRepository.js
src/data/firestore/commentRepository.js
src/data/firestore/reactionRepository.js
src/data/firestore/feedQuery.js
```

Keep temporary named exports delegating to new modules until all imports move. Delete the facade after contract parity.

### `src/services/cloudinaryService.js`

Move/wrap as `src/data/media/cloudinaryGateway.js` implementing:

```js
uploadPostImage({ blob, ownerId, postId, signal })
```

Return a validated normalized receipt. No toasts, local state, retry, or Firestore writes.

### `src/utils/uploadImageStore.js`

Current store becomes legacy reader/migrator only. New implementation uses owner-scoped `imageBlobs` and `imageJobs` in one database/transaction.

Delete only after legacy blob migration and quarantine.

### `src/services/syncQueueService.js`

Temporary:

- versioned validator;
- per-UID storage;
- quarantine;
- compaction;
- explicit write results.

Target: legacy migration reader only, then delete after Phase 9.

### `src/utils/storage.js`

Keep only while legacy localStorage migration exists. New application paths must not import it. Delete or move under `src/migrations` after cleanup.

### `src/utils/feedPostIdentity.js`

Replace with general stable identity/alias helpers in `src/domain/feed/ids.js`. Delete after all post/comment/reply callers migrate.

### `src/utils/feedFactories.js` and `feedMutations.js`

Move pure model behavior to `src/domain/feed`. Preserve exports temporarily for compatibility. Delete unused seed-only helpers after import audit.

## Configuration

### `src/config/firebaseFirestore.js`

Change to the sole Firestore initializer with persistent multi-tab cache and tested memory fallback. No other module calls `getFirestore` or `initializeFirestore`.

### `src/config/firebaseApp.js`, `firebaseAuth.js`

Keep, but ensure initialization order is deterministic and tests can inject emulator configuration before use.

### `firestore.rules`

Modify only in Phase 8 with emulator tests.

### `firestore.indexes.json`

Update only from the final repository query inventory. Do not delete existing indexes merely because a source search does not show an exact matching `orderBy`.

## New files/directories

Suggested final tree:

```text
src/
  domain/feed/
    ids.js
    invariants.js
    merge.js
    model.js
    selectors.js
  data/firestore/
    converters.js
    profileRepository.js
    postRepository.js
    commentRepository.js
    reactionRepository.js
    feedQuery.js
  data/media/
    imageDatabase.js
    imageJobRepository.js
    cloudinaryGateway.js
  features/feed/
    feedRepository.js
    feedController.js
    feedCommands.js
    feedStatus.js
  features/media/
    imageUploadWorker.js
    imageStatus.js
  migrations/
    legacyFeedCache.js
    legacyQueue.js
    legacyImages.js
```

Names can change if repository conventions require it, but responsibilities and dependency direction must remain.

## Candidate dead code

After the v2 cutover, verify with import search, lint, tests, and build before deleting:

```text
src/services/postService.js
src/services/userService.js
src/data/json/posts.json
src/data/json/currentUser.json
src/data/adapters/postAdapter.js
src/data/adapters/userAdapter.js
normalizeSeedPost / normalizeSeedPosts exports
```

Do not remove auth page JSON/adapters or UI text service; they are active.

## Documentation updates at completion

Update `README.md`:

- correct actual config filenames;
- explain Firestore persistent offline behavior;
- document media-only job storage;
- remove the general localStorage queue description;
- document v1/v2 schema compatibility;
- document emulator test commands;
- remove absolute local seed image paths or make them configurable;
- preserve credential safety guidance.


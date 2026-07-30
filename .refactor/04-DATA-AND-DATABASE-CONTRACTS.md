# 04 — Data and Database Contracts

## Compatibility principle

Migrate additively:

1. New readers accept schema v1 and v2.
2. New writers create v2 documents using stable IDs.
3. Existing v1 documents are not bulk-rewritten during the application refactor.
4. Remove v1 read support only after a separate audited data migration.

## Canonical v2 Firestore documents

Field names below intentionally retain current collection names and most current fields.

### `users/{uid}`

```js
{
  schemaVersion: 2,
  firstName: string,       // 1..50
  lastName: string,        // 1..50
  email: string,           // immutable from this client after create
  avatarColor: string,     // constrained format/length
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

The document ID and authenticated UID must match.

### `posts/{postId}`

```js
{
  schemaVersion: 2,
  userId: uid,
  text: string,                 // 0..configured max; image-only post allowed
  visibility: 'public' | 'private',
  imageUrl: string | null,
  imagePublicId: string | null,
  imageProvider: 'cloudinary' | null,
  clientCreatedAt: Timestamp,   // immediate local ordering
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),

  // Transitional compatibility:
  localId: postId,
  author: optional legacy snapshot,
  likesCount: optional legacy/read-only,
  commentsCount: optional legacy/read-only
}
```

The mapper reads `createdAt` with a local estimate and falls back to `clientCreatedAt`. New client code never trusts or writes aggregate counters after creation.

### `comments/{commentId}`

```js
{
  schemaVersion: 2,
  postId,
  userId: uid,
  text: string,
  clientCreatedAt: Timestamp,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),

  // Transitional compatibility:
  localId: commentId,
  author: optional legacy snapshot,
  likesCount: optional legacy/read-only,
  repliesCount: optional legacy/read-only
}
```

The referenced post must exist and be readable by the creator.

### `replies/{replyId}`

```js
{
  schemaVersion: 2,
  postId,
  commentId,
  userId: uid,
  text: string,
  clientCreatedAt: Timestamp,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),

  // Transitional compatibility:
  localId: replyId,
  author: optional legacy snapshot,
  likesCount: optional legacy/read-only
}
```

The referenced comment must belong to the referenced post.

### Like documents

```js
// postLikes/{encoded(postId, uid)}
{
  schemaVersion: 2,
  postId,
  userId: uid,
  clientCreatedAt: Timestamp,
  createdAt: serverTimestamp()
}

// commentLikes/{encoded(commentId, uid)}
{
  schemaVersion: 2,
  postId,
  commentId,
  userId: uid,
  clientCreatedAt: Timestamp,
  createdAt: serverTimestamp()
}

// replyLikes/{encoded(replyId, uid)}
{
  schemaVersion: 2,
  postId,
  commentId,
  replyId,
  userId: uid,
  clientCreatedAt: Timestamp,
  createdAt: serverTimestamp()
}
```

Rules must validate both the actor and referenced parent chain. Like documents are create/delete only.

## Author presentation

The v2 domain model resolves `author` from `users/{userId}`. Legacy embedded author data is a fallback only.

Profile repository requirements:

- deduplicate concurrent UID reads;
- cache resolved profiles with an explicit invalidation policy;
- never cache a rejected promise permanently;
- default safely if a profile was deleted;
- mapper output must keep the current UI shape `{id, name, initials, avatarColor}`.

## Canonical UI projection

The UI continues to receive:

```js
{
  id: stableId,
  author: { id, name, initials, avatarColor },
  createdAt: ISOString,
  displayTime: string,
  visibility,
  title,
  image,
  imageRemoteUrl,
  imagePublicId,
  syncStatus,
  syncError,
  imageUploadStatus,
  likes: {
    count,
    likedByCurrentUser,
    previewUsers
  },
  comments: {
    previousCount,
    items: [
      {
        id,
        author,
        text,
        displayTime,
        syncStatus,
        syncError,
        likes: { count, likedByCurrentUser },
        replies: [...]
      }
    ]
  }
}
```

This is a selector result, not a persisted record. `displayTime`, nested arrays, preview users, and sync labels must not be written to Firestore or a whole-feed browser cache.

## Firestore snapshot metadata mapping

Each normalized entity carries internal metadata outside the persisted document:

```js
{
  fromCache: snapshot.metadata.fromCache,
  hasPendingWrites: snapshot.metadata.hasPendingWrites
}
```

Presentation status mapping:

- `hasPendingWrites === true` -> `syncStatus: 'pending'`;
- acknowledged Firestore document -> `syncStatus: 'synced'`;
- rejected command tracked by command error boundary -> `syncStatus: 'failed'`;
- media job controls `imageUploadStatus` independently.

Do not persist these derived values back to Firestore.

## IndexedDB v2 media database

Suggested database: `buddyScriptMedia`, version `1`.

### `imageBlobs`

Key: `[ownerId, postId]`

```js
{
  ownerId,
  postId,
  blob,
  mimeType: 'image/jpeg',
  byteLength,
  createdAt
}
```

### `imageJobs`

Key: `[ownerId, postId]`

Indexes: `ownerId`, `status`, `nextAttemptAt`, `leaseUntil`.

```js
{
  schemaVersion: 1,
  ownerId,
  postId,
  status: 'pending' | 'uploading' | 'retrying' | 'blocked',
  attempts: 0,
  nextAttemptAt,
  lastError: null,
  createdAt,
  updatedAt,
  leaseOwner: null,
  leaseUntil: null,
  uploadReceipt: null | {
    url,
    publicId,
    provider: 'cloudinary',
    receivedAt
  }
}
```

Blob and job insertion must be one IndexedDB transaction. Receipt persistence must happen before the Firestore image URL write.

## Legacy local contracts

### Legacy feed cache

Read-only migration input:

```text
buddyScript.feed.posts.${encodedUid}
buddyScript.feed.version.${encodedUid} == "3"
```

### Legacy queue

Read-only migration input:

```text
buddyScript.feed.syncQueue
```

Because it lacks an owner field, ownership inference must follow this order:

1. explicit payload `userId`;
2. payload entity author ID;
3. exactly one matching entity in one UID-scoped feed cache;
4. otherwise quarantine as ambiguous.

Never infer ownership from the currently logged-in user.

## Validation boundary

Validate at all three points:

- command input before write;
- converter/migration input before normalization;
- Firestore rules before acceptance.

Validation must cover:

- allowed keys and types;
- string lengths;
- visibility enum;
- UID ownership;
- immutable identity/parent/timestamp fields;
- parent existence and visibility;
- image URL/provider constraints appropriate to the deployment.

Do not silently coerce malformed remote documents into writable valid data. Normalize for display and record a diagnostic.


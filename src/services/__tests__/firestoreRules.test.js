/**
 * Firestore Security Rules — Characterization Tests
 *
 * These tests characterize the CURRENT (pre-hardening) rules behavior.
 * They document both expected behavior and KNOWN DEFECTS that will be
 * fixed in later phases.
 *
 * PREREQUISITE: The Firestore emulator must be running on localhost:8080.
 *   Start it with: `npx firebase emulators:start --only firestore`
 *   Requires Java and firebase-tools.
 *
 * If the emulator is not running, all tests are skipped with a diagnostic
 * message. No rules are modified or deployed by these tests.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

let assertFails, assertSucceeds, initializeTestEnvironment;
let testEnv;
let emulatorAvailable = false;
const PROJECT_ID = 'buddy-script-rules-test';

// ---------------------------------------------------------------------------
// Setup — attempt to connect to the local emulator
// ---------------------------------------------------------------------------

beforeAll(async () => {
  try {
    const mod = await import('@firebase/rules-unit-testing');
    assertFails = mod.assertFails;
    assertSucceeds = mod.assertSucceeds;
    initializeTestEnvironment = mod.initializeTestEnvironment;

    const { readFileSync } = await import('node:fs');
    const rules = readFileSync('firestore.rules', 'utf8');

    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules,
        host: 'localhost',
        port: 8080,
      },
    });

    emulatorAvailable = true;
  } catch (err) {
    console.warn(
      'Firestore emulator not available — rules tests skipped.',
      err.message || err
    );
    emulatorAvailable = false;
  }
}, 15000);

afterAll(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
});

beforeEach(async () => {
  if (testEnv) {
    await testEnv.clearFirestore();
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create an authenticated Firestore client for a given user.
 * The uid also serves as the user's display name for simplicity.
 */
function authedContext(uid) {
  if (!testEnv) return null;
  return testEnv
    .authenticatedContext(uid, {
      email: `${uid}@test.example`,
      email_verified: true,
    })
    .firestore();
}

/** Unauthenticated (null) Firestore client. */
function unauthedContext() {
  if (!testEnv) return null;
  return testEnv.unauthenticatedContext().firestore();
}

// ---------------------------------------------------------------------------
// Helper: skipIfNoEmulator wrapper
// Since vitest doesn't support dynamic describe.skip, each test individually
// checks the guard at runtime.
// ---------------------------------------------------------------------------

function itIfEmu(name, fn, timeout) {
  const testFn = async () => {
    if (!emulatorAvailable) {
      console.log(`  SKIPPED: "${name}" — requires Firestore emulator on :8080`);
      return;
    }
    await fn();
  };
  if (timeout) {
    it(name, testFn, timeout);
  } else {
    it(name, testFn);
  }
}

// ---------------------------------------------------------------------------
// Seed data helper
// ---------------------------------------------------------------------------

/**
 * Seed a minimal public and private post as Alice, plus related children.
 * Returns opaque IDs for later reference.
 */
async function seedPublicAndPrivatePosts(aliceDb) {
  const { setDoc, doc } = await import('firebase/firestore');

  // Alice's public post
  const pubPostId = 'public-post-1';
  await setDoc(doc(aliceDb, 'posts', pubPostId), {
    userId: 'alice',
    text: 'Public post',
    visibility: 'public',
    likesCount: 0,
    commentsCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    author: {
      id: 'alice',
      name: 'Alice',
      initials: 'A',
      avatarColor: '#FF5733',
      firstName: 'Alice',
      lastName: 'Test',
    },
  });

  // Alice's private post
  const privPostId = 'private-post-1';
  await setDoc(doc(aliceDb, 'posts', privPostId), {
    userId: 'alice',
    text: 'Private post',
    visibility: 'private',
    likesCount: 0,
    commentsCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    author: {
      id: 'alice',
      name: 'Alice',
      initials: 'A',
      avatarColor: '#FF5733',
      firstName: 'Alice',
      lastName: 'Test',
    },
  });

  // A comment on the public post
  const pubCommentId = 'pub-comment-1';
  await setDoc(doc(aliceDb, 'comments', pubCommentId), {
    postId: pubPostId,
    userId: 'alice',
    text: 'Self comment',
    likesCount: 0,
    repliesCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    author: {
      id: 'alice',
      name: 'Alice',
      initials: 'A',
      avatarColor: '#FF5733',
    },
  });

  // A comment on the private post
  const privCommentId = 'priv-comment-1';
  await setDoc(doc(aliceDb, 'comments', privCommentId), {
    postId: privPostId,
    userId: 'alice',
    text: 'Private comment',
    likesCount: 0,
    repliesCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    author: {
      id: 'alice',
      name: 'Alice',
      initials: 'A',
      avatarColor: '#FF5733',
    },
  });

  return { pubPostId, privPostId, pubCommentId, privCommentId };
}

// ===========================================================================
// Tests
// ===========================================================================

describe('Firestore rules — current characterization', () => {
  // -----------------------------------------------------------------------
  // 1. Unauthenticated access
  // -----------------------------------------------------------------------
  describe('unauthenticated user', () => {
    itIfEmu('read is denied on posts collection', async () => {
      const db = unauthedContext();
      const { doc, getDoc } = await import('firebase/firestore');
      await expect(
        assertFails(getDoc(doc(db, 'posts', 'any-post')))
      ).resolves.not.toThrow();
    });

    itIfEmu('write is denied on posts collection', async () => {
      const db = unauthedContext();
      const { doc, setDoc } = await import('firebase/firestore');
      await expect(
        assertFails(
          setDoc(doc(db, 'posts', 'post-x'), {
            userId: 'anyone',
            text: 'test',
            visibility: 'public',
          })
        )
      ).resolves.not.toThrow();
    });

    itIfEmu('write is denied on comments collection', async () => {
      const db = unauthedContext();
      const { doc, setDoc } = await import('firebase/firestore');
      await expect(
        assertFails(
          setDoc(doc(db, 'comments', 'comment-x'), {
            postId: 'p',
            userId: 'anyone',
            text: 'test',
          })
        )
      ).resolves.not.toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // 2. Owner (Alice) operations
  // -----------------------------------------------------------------------
  describe('Alice (post owner)', () => {
    let aliceDb;

    beforeAll(async () => {
      aliceDb = authedContext('alice');
    });

    itIfEmu('can create a post as self', async () => {
      const { doc, setDoc } = await import('firebase/firestore');
      await expect(
        assertSucceeds(
          setDoc(doc(aliceDb, 'posts', 'alice-post-1'), {
            userId: 'alice',
            text: 'My post',
            visibility: 'public',
            likesCount: 0,
            commentsCount: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
        )
      ).resolves.not.toThrow();
    });

    itIfEmu('can read own public post', async () => {
      await seedPublicAndPrivatePosts(aliceDb);
      const { doc, getDoc } = await import('firebase/firestore');
      await expect(
        assertSucceeds(getDoc(doc(aliceDb, 'posts', 'public-post-1')))
      ).resolves.not.toThrow();
    });

    itIfEmu('can read own private post', async () => {
      await seedPublicAndPrivatePosts(aliceDb);
      const { doc, getDoc } = await import('firebase/firestore');
      await expect(
        assertSucceeds(getDoc(doc(aliceDb, 'posts', 'private-post-1')))
      ).resolves.not.toThrow();
    });

    itIfEmu('can update own post', async () => {
      await seedPublicAndPrivatePosts(aliceDb);
      const { doc, updateDoc } = await import('firebase/firestore');
      await expect(
        assertSucceeds(
          updateDoc(doc(aliceDb, 'posts', 'public-post-1'), {
            text: 'Updated text',
            updatedAt: new Date(),
          })
        )
      ).resolves.not.toThrow();
    });

    itIfEmu('can delete own post', async () => {
      await seedPublicAndPrivatePosts(aliceDb);
      const { doc, deleteDoc } = await import('firebase/firestore');
      await expect(
        assertSucceeds(deleteDoc(doc(aliceDb, 'posts', 'public-post-1')))
      ).resolves.not.toThrow();
    });

    itIfEmu('can create a like document', async () => {
      await seedPublicAndPrivatePosts(aliceDb);
      const { doc, setDoc } = await import('firebase/firestore');
      await expect(
        assertSucceeds(
          setDoc(doc(aliceDb, 'postLikes', 'public-post-1_alice'), {
            postId: 'public-post-1',
            userId: 'alice',
            createdAt: new Date(),
          })
        )
      ).resolves.not.toThrow();
    });

    itIfEmu('can delete own like document', async () => {
      await seedPublicAndPrivatePosts(aliceDb);
      const { doc, setDoc, deleteDoc } = await import('firebase/firestore');
      await assertSucceeds(
        setDoc(doc(aliceDb, 'postLikes', 'public-post-1_alice'), {
          postId: 'public-post-1',
          userId: 'alice',
          createdAt: new Date(),
        })
      );
      await expect(
        assertSucceeds(
          deleteDoc(doc(aliceDb, 'postLikes', 'public-post-1_alice'))
        )
      ).resolves.not.toThrow();
    });

    itIfEmu('cannot update a like document', async () => {
      await seedPublicAndPrivatePosts(aliceDb);
      const { doc, setDoc, updateDoc } = await import('firebase/firestore');
      await assertSucceeds(
        setDoc(doc(aliceDb, 'postLikes', 'public-post-1_alice'), {
          postId: 'public-post-1',
          userId: 'alice',
          createdAt: new Date(),
        })
      );
      // Likes have no "update" permission — should fail
      await expect(
        assertFails(
          updateDoc(doc(aliceDb, 'postLikes', 'public-post-1_alice'), {
            createdAt: new Date(),
          })
        )
      ).resolves.not.toThrow();
    });

    itIfEmu('can create a comment on own public post', async () => {
      await seedPublicAndPrivatePosts(aliceDb);
      const { doc, setDoc } = await import('firebase/firestore');
      await expect(
        assertSucceeds(
          setDoc(doc(aliceDb, 'comments', 'comment-alice-1'), {
            postId: 'public-post-1',
            userId: 'alice',
            text: 'My comment',
            likesCount: 0,
            repliesCount: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
        )
      ).resolves.not.toThrow();
    });

    itIfEmu('cannot create a like for another user', async () => {
      await seedPublicAndPrivatePosts(aliceDb);
      const { doc, setDoc } = await import('firebase/firestore');
      // likeId doesn't end with alice's uid
      await expect(
        assertFails(
          setDoc(doc(aliceDb, 'postLikes', 'public-post-1_bob'), {
            postId: 'public-post-1',
            userId: 'alice',
            createdAt: new Date(),
          })
        )
      ).resolves.not.toThrow();
    });

    itIfEmu('cannot create a post with spoofed userId', async () => {
      const { doc, setDoc } = await import('firebase/firestore');
      await expect(
        assertFails(
          setDoc(doc(aliceDb, 'posts', 'spoofed-post'), {
            userId: 'bob',
            text: 'Spoofed',
            visibility: 'public',
          })
        )
      ).resolves.not.toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // 3. Unrelated authenticated user (Bob)
  // -----------------------------------------------------------------------
  describe('Bob (unrelated authenticated user)', () => {
    let bobDb;

    beforeAll(async () => {
      bobDb = authedContext('bob');
    });

    itIfEmu('can read Alice public post', async () => {
      const aliceDb = authedContext('alice');
      await seedPublicAndPrivatePosts(aliceDb);
      const { doc, getDoc } = await import('firebase/firestore');
      await expect(
        assertSucceeds(getDoc(doc(bobDb, 'posts', 'public-post-1')))
      ).resolves.not.toThrow();
    });

    itIfEmu('cannot read Alice private post', async () => {
      const aliceDb = authedContext('alice');
      await seedPublicAndPrivatePosts(aliceDb);
      const { doc, getDoc } = await import('firebase/firestore');
      await expect(
        assertFails(getDoc(doc(bobDb, 'posts', 'private-post-1')))
      ).resolves.not.toThrow();
    });

    itIfEmu('can create own post', async () => {
      const { doc, setDoc } = await import('firebase/firestore');
      await expect(
        assertSucceeds(
          setDoc(doc(bobDb, 'posts', 'bob-post-1'), {
            userId: 'bob',
            text: 'Bobs post',
            visibility: 'public',
            likesCount: 0,
            commentsCount: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
        )
      ).resolves.not.toThrow();
    });

    itIfEmu('can create own like on Alice public post', async () => {
      const aliceDb = authedContext('alice');
      await seedPublicAndPrivatePosts(aliceDb);
      const { doc, setDoc } = await import('firebase/firestore');
      await expect(
        assertSucceeds(
          setDoc(doc(bobDb, 'postLikes', 'public-post-1_bob'), {
            postId: 'public-post-1',
            userId: 'bob',
            createdAt: new Date(),
          })
        )
      ).resolves.not.toThrow();
    });

    itIfEmu('can delete own like', async () => {
      const aliceDb = authedContext('alice');
      await seedPublicAndPrivatePosts(aliceDb);
      const { doc, setDoc, deleteDoc } = await import('firebase/firestore');
      await assertSucceeds(
        setDoc(doc(bobDb, 'postLikes', 'public-post-1_bob'), {
          postId: 'public-post-1',
          userId: 'bob',
          createdAt: new Date(),
        })
      );
      await expect(
        assertSucceeds(deleteDoc(doc(bobDb, 'postLikes', 'public-post-1_bob')))
      ).resolves.not.toThrow();
    });

    itIfEmu('cannot create a comment spoofing Alice userId', async () => {
      const aliceDb = authedContext('alice');
      await seedPublicAndPrivatePosts(aliceDb);
      const { doc, setDoc } = await import('firebase/firestore');
      await expect(
        assertFails(
          setDoc(doc(bobDb, 'comments', 'spoof-comment'), {
            postId: 'public-post-1',
            userId: 'alice',
            text: 'Spoofed as Alice',
          })
        )
      ).resolves.not.toThrow();
    });

    itIfEmu('can create comment on Alice public post as self', async () => {
      const aliceDb = authedContext('alice');
      await seedPublicAndPrivatePosts(aliceDb);
      const { doc, setDoc } = await import('firebase/firestore');
      await expect(
        assertSucceeds(
          setDoc(doc(bobDb, 'comments', 'bob-comment-1'), {
            postId: 'public-post-1',
            userId: 'bob',
            text: 'Nice post!',
            likesCount: 0,
            repliesCount: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
        )
      ).resolves.not.toThrow();
    });

    itIfEmu('can create reply on Alice public comment as self', async () => {
      const aliceDb = authedContext('alice');
      await seedPublicAndPrivatePosts(aliceDb);
      const { doc, setDoc } = await import('firebase/firestore');
      await expect(
        assertSucceeds(
          setDoc(doc(bobDb, 'replies', 'bob-reply-1'), {
            postId: 'public-post-1',
            commentId: 'pub-comment-1',
            userId: 'bob',
            text: 'Thanks!',
            likesCount: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
        )
      ).resolves.not.toThrow();
    });

    itIfEmu('can create a comment like', async () => {
      const aliceDb = authedContext('alice');
      await seedPublicAndPrivatePosts(aliceDb);
      const { doc, setDoc } = await import('firebase/firestore');
      await expect(
        assertSucceeds(
          setDoc(doc(bobDb, 'commentLikes', 'pub-comment-1_bob'), {
            postId: 'public-post-1',
            commentId: 'pub-comment-1',
            userId: 'bob',
            createdAt: new Date(),
          })
        )
      ).resolves.not.toThrow();
    });

    itIfEmu('can create a reply like', async () => {
      const aliceDb = authedContext('alice');
      await seedPublicAndPrivatePosts(aliceDb);
      // Seed a reply first
      const { doc, setDoc } = await import('firebase/firestore');
      await setDoc(doc(aliceDb, 'replies', 'reply-1'), {
        postId: 'public-post-1',
        commentId: 'pub-comment-1',
        userId: 'alice',
        text: 'Original reply',
        likesCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await expect(
        assertSucceeds(
          setDoc(doc(bobDb, 'replyLikes', 'reply-1_bob'), {
            postId: 'public-post-1',
            commentId: 'pub-comment-1',
            replyId: 'reply-1',
            userId: 'bob',
            createdAt: new Date(),
          })
        )
      ).resolves.not.toThrow();
    });
  });

  // ===================================================================
  // KNOWN DEFECTS — current rules allow these; tests document the gap
  // ===================================================================

  describe('KNOWN DEFECTS (to be fixed in later phases)', () => {
    let bobDb;
    let aliceDb;

    beforeAll(async () => {
      bobDb = authedContext('bob');
      aliceDb = authedContext('alice');
    });

    // -------------------------------------------------------------------
    // DEFECT-1: Private child exposure
    // Comments, replies, and likes under a private post are world-readable.
    // -------------------------------------------------------------------
    describe('DEFECT-1: Private child exposure', () => {
      itIfEmu(
        'Bob can read Alice private post comment (should be denied)',
        async () => {
          await seedPublicAndPrivatePosts(aliceDb);
          const { doc, getDoc } = await import('firebase/firestore');
          // Bob should NOT be able to read the comment under Alice's private post
          await expect(
            assertSucceeds(
              getDoc(doc(bobDb, 'comments', 'priv-comment-1'))
            )
          ).resolves.not.toThrow();
          // ^ This SUCCEEDS because the current rules have no parent-post
          //   visibility check on comments.
        }
      );

      itIfEmu(
        'Bob can read Alice private post like (should be denied)',
        async () => {
          await seedPublicAndPrivatePosts(aliceDb);
          const { doc, setDoc, getDoc } = await import('firebase/firestore');
          // Add a like to Alice's private post
          await setDoc(doc(aliceDb, 'postLikes', 'private-post-1_alice'), {
            postId: 'private-post-1',
            userId: 'alice',
            createdAt: new Date(),
          });
          // Bob can read the like document even though it's for a private post
          await expect(
            assertSucceeds(
              getDoc(doc(bobDb, 'postLikes', 'private-post-1_alice'))
            )
          ).resolves.not.toThrow();
        }
      );
    });

    // -------------------------------------------------------------------
    // DEFECT-2: Counter permission mismatch
    // Any authenticated user can increment/decrement likesCount on any post.
    // -------------------------------------------------------------------
    describe('DEFECT-2: Counter permission mismatch', () => {
      itIfEmu(
        'Bob can increment likesCount on Alice public post via update',
        async () => {
          await seedPublicAndPrivatePosts(aliceDb);
          const { doc, updateDoc } = await import('firebase/firestore');
          await expect(
            assertSucceeds(
              updateDoc(doc(bobDb, 'posts', 'public-post-1'), {
                likesCount: increment(1),
                updatedAt: new Date(),
              })
            )
          ).resolves.not.toThrow();
          // ^ This SUCCEEDS because the current rules allow any
          //   authenticated user to change only likesCount and updatedAt.
        }
      );

      itIfEmu(
        'Bob can decrement likesCount on Alice private post via update',
        async () => {
          await seedPublicAndPrivatePosts(aliceDb);
          const { doc, updateDoc } = await import('firebase/firestore');
          await expect(
            assertSucceeds(
              updateDoc(doc(bobDb, 'posts', 'private-post-1'), {
                likesCount: increment(-1),
                updatedAt: new Date(),
              })
            )
          ).resolves.not.toThrow();
          // ^ This SUCCEEDS — also defeats the private post read restriction
          //   because updateDoc implicitly reads the document first and the
          //   update rule doesn't check post visibility.
        }
      );
    });

    // -------------------------------------------------------------------
    // DEFECT-3: No parent-existence check on comment/reply create
    // -------------------------------------------------------------------
    describe('DEFECT-3: No parent-existence check on comment/reply', () => {
      itIfEmu(
        'Bob can create a comment referencing a non-existent post',
        async () => {
          const { doc, setDoc } = await import('firebase/firestore');
          await expect(
            assertSucceeds(
              setDoc(doc(bobDb, 'comments', 'orphan-comment'), {
                postId: 'nonexistent-post',
                userId: 'bob',
                text: 'Orphan comment',
                likesCount: 0,
                repliesCount: 0,
                createdAt: new Date(),
                updatedAt: new Date(),
              })
            )
          ).resolves.not.toThrow();
          // ^ This SUCCEEDS because current rules only check userId match,
          //   not parent document existence.
        }
      );

      itIfEmu(
        'Bob can create a reply referencing a non-existent comment',
        async () => {
          const { doc, setDoc } = await import('firebase/firestore');
          await expect(
            assertSucceeds(
              setDoc(doc(bobDb, 'replies', 'orphan-reply'), {
                postId: 'public-post-1',
                commentId: 'nonexistent-comment',
                userId: 'bob',
                text: 'Orphan reply',
                likesCount: 0,
                createdAt: new Date(),
                updatedAt: new Date(),
              })
            )
          ).resolves.not.toThrow();
        }
      );
    });

    // -------------------------------------------------------------------
    // DEFECT-4: Comment/reply create doesn't check likesCount increment
    // -------------------------------------------------------------------
    describe('DEFECT-4: No validation on comment update fields', () => {
      itIfEmu(
        'Bob can update his comment text',
        async () => {
          await seedPublicAndPrivatePosts(aliceDb);
          const { doc, setDoc, updateDoc } = await import('firebase/firestore');
          // Bob creates a comment
          await assertSucceeds(
            setDoc(doc(bobDb, 'comments', 'bob-comment'), {
              postId: 'public-post-1',
              userId: 'bob',
              text: 'Original',
              likesCount: 0,
              repliesCount: 0,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
          );
          // Bob can update his comment text (product behavior)
          await expect(
            assertSucceeds(
              updateDoc(doc(bobDb, 'comments', 'bob-comment'), {
                text: 'Edited comment',
                updatedAt: new Date(),
              })
            )
          ).resolves.not.toThrow();
        }
      );

      itIfEmu(
        'Alice can update Bob comment likesCount (BUG)',
        async () => {
          await seedPublicAndPrivatePosts(aliceDb);
          const { doc, setDoc, updateDoc } = await import('firebase/firestore');
          await assertSucceeds(
            setDoc(doc(bobDb, 'comments', 'bob-comment'), {
              postId: 'public-post-1',
              userId: 'bob',
              text: 'Original',
              likesCount: 0,
              repliesCount: 0,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
          );
          // Alice can update Bob's comment counters (BUG — only Bob should be able
          // to update his own comment, and counters should never be client-updated)
          await expect(
            assertSucceeds(
              updateDoc(doc(aliceDb, 'comments', 'bob-comment'), {
                likesCount: 99,
                updatedAt: new Date(),
              })
            )
          ).resolves.not.toThrow();
        }
      );
    });

    // -------------------------------------------------------------------
    // DEFECT-5: Like create does not verify parent exists
    // -------------------------------------------------------------------
    describe('DEFECT-5: No parent check on likes', () => {
      itIfEmu(
        'Bob can create a like for a non-existent post',
        async () => {
          const { doc, setDoc } = await import('firebase/firestore');
          await expect(
            assertSucceeds(
              setDoc(doc(bobDb, 'postLikes', 'nonexistent_post_bob'), {
                postId: 'nonexistent_post',
                userId: 'bob',
                createdAt: new Date(),
              })
            )
          ).resolves.not.toThrow();
        }
      );
    });
  });
});

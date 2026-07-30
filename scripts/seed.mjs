#!/usr/bin/env node

/**
 * Seed script — uploads images from disk to Cloudinary and seeds Firestore with
 * users, posts, comments, replies, and likes.
 *
 * Prerequisites:
 *   1. npm install firebase-admin   (from project root)
 *   2. Get a Firebase service account key:
 *        Firebase Console → Project Settings → Service Accounts →
 *        "Generate new private key" → save as scripts/service-account.json
 *   3. node scripts/seed.mjs
 *
 * Auth accounts are also created so you can log in as any seed user at:
 *   Email:  {firstName}@example.com   (e.g. dylan@example.com)
 *   Pass:   password123
 */

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------
import { readFile, readdir } from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import admin from 'firebase-admin';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// ---------------------------------------------------------------------------
// Configuration — reads from app .env.local
// ---------------------------------------------------------------------------
const ENV_PATH = resolve(import.meta.dirname, '..', '.env.local');

function loadDotEnv(path) {
  const text = readFileSync(path, 'utf-8');
  const vars = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const sep = trimmed.indexOf('=');
    if (sep === -1) continue;
    const key = trimmed.slice(0, sep).trim();
    const val = trimmed.slice(sep + 1).trim().replace(/^["']|["']$/g, '');
    vars[key] = val;
  }
  return vars;
}

const env = loadDotEnv(ENV_PATH);

const CLOUDINARY_CLOUD_NAME = env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = env.VITE_CLOUDINARY_UPLOAD_PRESET;
const PROJECT_ID = env.VITE_FIREBASE_PROJECT_ID;

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const SERVICE_ACCOUNT_PATH = resolve(import.meta.dirname, 'service-account.json');
const IMAGES_DIR = 'C:/Users/Shahriar/Downloads/images/posts';

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

const USERS = [
  {
    uid: 'user-karim',
    firstName: 'Karim',
    lastName: 'Saif',
    email: 'karim@example.com',
    avatarColor: '#0ACF83',
  },
  {
    uid: 'user-dylan',
    firstName: 'Dylan',
    lastName: 'Field',
    email: 'dylan@example.com',
    avatarColor: '#1890FF',
  },
  {
    uid: 'user-julia',
    firstName: 'Julia',
    lastName: 'Stone',
    email: 'julia@example.com',
    avatarColor: '#1890FF',
  },
  {
    uid: 'user-maya',
    firstName: 'Maya',
    lastName: 'Redwood',
    email: 'maya@example.com',
    avatarColor: '#845EF7',
  },
  {
    uid: 'user-ava',
    firstName: 'Ava',
    lastName: 'Brooks',
    email: 'ava@example.com',
    avatarColor: '#FFD43B',
  },
  {
    uid: 'user-radovan',
    firstName: 'Radovan',
    lastName: 'SkillArena',
    email: 'radovan@example.com',
    avatarColor: '#FEA364',
  },
];

const USERS_MAP = Object.fromEntries(USERS.map((u) => [u.uid, u]));

function authorSnapshot(uid) {
  const u = USERS_MAP[uid];
  return {
    id: uid,
    name: `${u.firstName} ${u.lastName}`,
    initials: u.firstName.charAt(0),
    avatarColor: u.avatarColor,
    firstName: u.firstName,
    lastName: u.lastName,
  };
}

function randomLikeCount() {
  return Math.floor(Math.random() * 80) + 3;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Build a set of seed posts. Images are assigned by filename pattern.
 * Returns an array of post definitions with optional `imageFile` field.
 */
function buildPosts(availableImages) {
  const imgMap = Object.fromEntries(
    availableImages.map((f) => [f.name, f])
  );

  const findImg = (prefix) => {
    const match = availableImages.find((f) => f.name.startsWith(prefix));
    return match || null;
  };

  return [
    // -- Posts with images (mapped by theme) --
    {
      id: 'seed-post-travel',
      userId: 'user-maya',
      text: 'Beautiful morning hike at Mount Rainier! Nature is the best therapy 🌲',
      visibility: 'public',
      imageFile: findImg('post_01_travel') || findImg('test_image_1'),
    },
    {
      id: 'seed-post-food',
      userId: 'user-ava',
      text: 'Homemade ramen night — finally perfected the broth recipe after 10 attempts! 🍜',
      visibility: 'public',
      imageFile: findImg('post_02_food') || findImg('test_image_2'),
    },
    {
      id: 'seed-post-fitness',
      userId: 'user-karim',
      text: 'New personal record on the 5K! Consistency beats intensity every time. 🏃',
      visibility: 'public',
      imageFile: findImg('post_03_fitness') || findImg('test_image_3'),
    },
    {
      id: 'seed-post-music',
      userId: 'user-radovan',
      text: 'Picked up the guitar again after years. Some things never leave you 🎸',
      visibility: 'public',
      imageFile: findImg('post_04_music') || findImg('test_image_4'),
    },
    {
      id: 'seed-post-art',
      userId: 'user-julia',
      text: 'Spent the weekend at the modern art museum. The installation pieces were incredible! 🎨',
      visibility: 'public',
      imageFile: findImg('post_05_art') || findImg('test_image_5'),
    },
    {
      id: 'seed-post-fashion',
      userId: 'user-julia',
      text: 'Found this vintage jacket at a thrift shop — sustainable fashion win! ♻️',
      visibility: 'public',
      imageFile: findImg('post_06_fashion') || findImg('test_image_6'),
    },
    {
      id: 'seed-post-pets',
      userId: 'user-maya',
      text: 'Meet Luna — the newest member of our team. She approves of the home office setup 🐾',
      visibility: 'public',
      imageFile: findImg('post_08_pets') || findImg('test_image_7'),
    },
    {
      id: 'seed-post-books',
      userId: 'user-dylan',
      text: 'Just finished "Designing Data-Intensive Applications" — mind-blowing insights on distributed systems!',
      visibility: 'public',
      imageFile: findImg('post_09_books') || findImg('test_image_5'),
    },
    {
      id: 'seed-post-coffee',
      userId: 'user-dylan',
      text: 'Early morning coding session — fuel of choice: pour-over coffee and lo-fi beats ☕',
      visibility: 'public',
      imageFile: findImg('post_10_coffee') || findImg('test_image_8'),
    },
    // -- Posts using remaining test images --
    {
      id: 'seed-post-tech-1',
      userId: 'user-radovan',
      text: 'React 19 is looking amazing! Server Components + improved hooks make building complex UIs so much cleaner.',
      visibility: 'public',
      imageFile: findImg('test_image_1') || null,
    },
    {
      id: 'seed-post-tech-2',
      userId: 'user-karim',
      text: 'Healthy Tracking App — just launched my new project! Built with React + Firebase. Check it out!',
      visibility: 'public',
      imageFile: findImg('test_image_2') || null,
    },
    {
      id: 'seed-post-tech-3',
      userId: 'user-ava',
      text: 'Just published my first open-source package! A lightweight state management library for React.',
      visibility: 'public',
      imageFile: findImg('test_image_3') || null,
    },
    // -- Text-only posts (no image) --
    {
      id: 'seed-post-private',
      userId: 'user-karim',
      text: 'Late night coding session. The new authentication flow is finally working end-to-end!',
      visibility: 'private',
      imageFile: null,
    },
    {
      id: 'seed-post-win',
      userId: 'user-julia',
      text: 'Our team just won the hackathon! 48 hours of pure coding, pizza, and teamwork. So proud! 🏆',
      visibility: 'public',
      imageFile: null,
    },
    {
      id: 'seed-post-css',
      userId: 'user-dylan',
      text: 'Exploring the new CSS container queries. Finally, true component-level responsive design!',
      visibility: 'public',
      imageFile: null,
    },
    {
      id: 'seed-post-advice',
      userId: 'user-maya',
      text: 'Tips for new developers: Don\'t be afraid to break things. Every bug fixed is a lesson learned! 💻',
      visibility: 'public',
      imageFile: null,
    },
  ];
}

/**
 * Build comments and replies for seed posts.
 * Returns an array of { postId, comments: [ {id, userId, text, replies: [ {id, userId, text} ] } ] }
 */
function buildComments(previousCommentIdCounter) {
  let cid = previousCommentIdCounter || 1;
  let rid = 1;

  return [
    {
      postId: 'seed-post-travel',
      comments: [
        {
          id: `seed-comment-${cid++}`,
          userId: 'user-ava',
          text: 'Stunning view! Which trail did you take?',
          replies: [
            { id: `seed-reply-${rid++}`, userId: 'user-maya', text: 'Skyline Trail — highly recommended!' },
          ],
        },
        {
          id: `seed-comment-${cid++}`,
          userId: 'user-karim',
          text: 'Mount Rainier is breathtaking this time of year! Great photos.',
          replies: [],
        },
      ],
    },
    {
      postId: 'seed-post-food',
      comments: [
        {
          id: `seed-comment-${cid++}`,
          userId: 'user-maya',
          text: 'Wow, that looks incredible! Would you share the recipe?',
          replies: [
            { id: `seed-reply-${rid++}`, userId: 'user-ava', text: 'Sure! I\'ll DM you the link!' },
          ],
        },
      ],
    },
    {
      postId: 'seed-post-music',
      comments: [
        {
          id: `seed-comment-${cid++}`,
          userId: 'user-dylan',
          text: 'Awesome! Learning an instrument is one of the most rewarding things you can do.',
          replies: [
            { id: `seed-reply-${rid++}`, userId: 'user-radovan', text: 'Totally agree — it\'s like therapy with calluses!' },
          ],
        },
      ],
    },
    {
      postId: 'seed-post-tech-1',
      comments: [
        {
          id: `seed-comment-${cid++}`,
          userId: 'user-dylan',
          text: 'The new use() hook is a game changer for data fetching patterns!',
          replies: [
            { id: `seed-reply-${rid++}`, userId: 'user-radovan', text: 'Absolutely! Combined with Suspense it feels like a whole new paradigm.' },
          ],
        },
      ],
    },
    {
      postId: 'seed-post-win',
      comments: [
        {
          id: `seed-comment-${cid++}`,
          userId: 'user-dylan',
          text: 'Congratulations! Your project was absolutely brilliant!',
          replies: [],
        },
        {
          id: `seed-comment-${cid++}`,
          userId: 'user-maya',
          text: 'So well deserved! The UI was stunning.',
          replies: [
            { id: `seed-reply-${rid++}`, userId: 'user-julia', text: 'Thank you both! Couldn\'t have done it without the team!' },
          ],
        },
      ],
    },
    {
      postId: 'seed-post-advice',
      comments: [
        {
          id: `seed-comment-${cid++}`,
          userId: 'user-radovan',
          text: 'Wish someone told me this when I started! Embrace the struggle.',
          replies: [
            { id: `seed-reply-${rid++}`, userId: 'user-maya', text: 'Exactly! The struggle is where the growth happens.' },
          ],
        },
        {
          id: `seed-comment-${cid++}`,
          userId: 'user-ava',
          text: 'Best advice I\'ve heard all week. Bookmarking this! 📌',
          replies: [],
        },
      ],
    },
    {
      postId: 'seed-post-css',
      comments: [
        {
          id: `seed-comment-${cid++}`,
          userId: 'user-karim',
          text: 'Container queries are a game changer for design systems! Pair them with :has() selector for magic.',
          replies: [],
        },
      ],
    },
    {
      postId: 'seed-post-books',
      comments: [
        {
          id: `seed-comment-${cid++}`,
          userId: 'user-maya',
          text: 'One of my favorite tech books! The chapter on replication was eye-opening.',
          replies: [
            { id: `seed-reply-${rid++}`, userId: 'user-dylan', text: 'Right? The deep dive on consensus algorithms was my favorite part.' },
          ],
        },
      ],
    },
    {
      postId: 'seed-post-pets',
      comments: [
        {
          id: `seed-comment-${cid++}`,
          userId: 'user-ava',
          text: 'Luna is adorable! Does she help with code reviews? 🐕',
          replies: [
            { id: `seed-reply-${rid++}`, userId: 'user-maya', text: 'She\'s the QA team — very thorough sniffer! 😄' },
          ],
        },
      ],
    },
  ];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Upload a single image to Cloudinary using the unsigned preset.
 */
async function uploadImage(filePath, fileName) {
  const buffer = await readFile(filePath);
  const blob = new Blob([buffer], { type: 'image/jpeg' });
  const fd = new FormData();
  fd.append('file', blob, fileName);
  fd.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
  const res = await fetch(url, { method: 'POST', body: fd });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Cloudinary upload failed for ${fileName}: ${res.status} ${body}`);
  }

  const data = await res.json();
  return { url: data.secure_url, publicId: data.public_id };
}

/**
 * Create or update a Firebase Auth user.
 */
async function ensureAuthUser(fs, au, uid, email, displayName, password) {
  try {
    await au.getUser(uid);
    console.log(`  ↳ Auth user ${email} already exists, skipping`);
    return;
  } catch {
    // User doesn't exist — create them
  }
  try {
    await au.createUser({
      uid,
      email,
      password,
      displayName,
    });
    console.log(`  ✓ Created auth user: ${email} (pass: ${password})`);
  } catch (err) {
    console.error(`  ✗ Failed to create auth user ${email}:`, err.message);
  }
}

/**
 * Write a document to Firestore with a known ID, wrapped in a short retry.
 */
async function setDocSafe(fs, collectionPath, docId, data) {
  const ref = fs.doc(`${collectionPath}/${docId}`);
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await ref.set(data);
      return;
    } catch (err) {
      if (attempt === 3) throw err;
      console.log(`    ↳ Retry ${attempt} for ${docId}...`);
      await sleep(500 * attempt);
    }
  }
}

/**
 * Delete all documents from a collection (used before seeding).
 */
async function deleteAllDocs(fs, collectionPath) {
  const snapshot = await fs.collection(collectionPath).get();
  if (snapshot.empty) return 0;
  const batch = fs.batch();
  let count = 0;
  snapshot.forEach((doc) => {
    batch.delete(doc.ref);
    count++;
  });
  await batch.commit();
  return count;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('\n========================================');
  console.log('  Firestore Database Seed Script');
  console.log('========================================\n');

  // ---- 1. Validate setup ----
  if (!existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error(
      '✗ service-account.json not found.\n' +
        `  Place it at: ${SERVICE_ACCOUNT_PATH}\n` +
        '  Get it from: Firebase Console → Project Settings → Service Accounts → Generate new private key\n'
    );
    process.exit(1);
  }

  if (!existsSync(IMAGES_DIR)) {
    console.error(`✗ Images directory not found: ${IMAGES_DIR}\n`);
    process.exit(1);
  }

  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
    console.error('✗ Cloudinary env vars (VITE_CLOUDINARY_CLOUD_NAME, VITE_CLOUDINARY_UPLOAD_PRESET) missing in .env.local\n');
    process.exit(1);
  }

  // ---- 2. Initialize Firebase Admin ----
  const serviceAccount = JSON.parse(await readFile(SERVICE_ACCOUNT_PATH, 'utf-8'));
  const app = admin.initializeApp({ credential: admin.cert(serviceAccount) });

  console.log('✓ Firebase Admin initialized');
  console.log(`  Project: ${serviceAccount.project_id}`);
  console.log(`  Images:  ${IMAGES_DIR}\n`);

  const firestore = getFirestore(app);
  const auth = getAuth(app);

  // ---- 3. Read available images ----
  const allFiles = await readdir(IMAGES_DIR);
  const imageFiles = allFiles
    .filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f))
    .sort()
    .map((name) => ({ name, path: resolve(IMAGES_DIR, name) }));

  console.log(`Found ${imageFiles.length} image(s) to upload.\n`);

  // ---- 4. Upload images to Cloudinary ----
  const uploadResults = new Map(); // fileName → { url, publicId }

  for (const img of imageFiles) {
    process.stdout.write(`  Uploading ${img.name} ... `);
    try {
      const result = await uploadImage(img.path, img.name);
      uploadResults.set(img.name, result);
      console.log('✓');
    } catch (err) {
      console.log(`✗  ${err.message}`);
    }
  }

  console.log(`\nUploaded ${uploadResults.size}/${imageFiles.length} images.\n`);

  // ---- 5. Build seed data with resolved image URLs ----
  const posts = buildPosts(
    imageFiles.map((f) => ({
      ...f,
      url: uploadResults.get(f.name)?.url || null,
      publicId: uploadResults.get(f.name)?.publicId || null,
    }))
  );

  const commentsByPost = buildComments(1);

  // ---- 6. Seed users ----
  console.log('── Seeding users ──');
  const NOW = FieldValue.serverTimestamp();

  // Optionally clear existing users data (comment out to keep existing)
  // const deletedUsers = await deleteAllDocs(firestore, 'users');
  // if (deletedUsers > 0) console.log(`  Cleared ${deletedUsers} existing user(s)`);

  for (const u of USERS) {
    const userDoc = {
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      avatarColor: u.avatarColor,
      createdAt: NOW,
      updatedAt: NOW,
    };
    await setDocSafe(firestore, 'users', u.uid, userDoc);
    console.log(`  ✓ Created user doc: ${u.firstName} ${u.lastName}`);
    await ensureAuthUser(firestore, auth, u.uid, u.email, `${u.firstName} ${u.lastName}`, 'password123');
  }
  console.log();

  // ---- 7. Seed posts ----
  console.log('── Seeding posts ──');

  for (const post of posts) {
    const now = new Date();
    // Stagger creation times so they sort in a natural order
    const idx = posts.indexOf(post);
    const createdAt = new Date(now.getTime() - (posts.length - idx) * 3600000);

    const postDoc = {
      localId: post.id,
      userId: post.userId,
      text: post.text,
      imageUrl: post.imageFile?.url || null,
      imagePublicId: post.imageFile?.publicId || null,
      visibility: post.visibility || 'public',
      createdAt: Timestamp.fromDate(createdAt),
      updatedAt: Timestamp.fromDate(createdAt),
      likesCount: 0,
      commentsCount: 0,
      author: authorSnapshot(post.userId),
    };

    await setDocSafe(firestore, 'posts', post.id, postDoc);
    console.log(`  ✓ Post: "${post.text.slice(0, 50)}..."`);
  }
  console.log();

  // ---- 8. Seed comments and replies ----
  console.log('── Seeding comments & replies ──');

  const commentLikesData = [];
  const replyLikesData = [];

  for (const group of commentsByPost) {
    const postId = group.postId;
    let commentCount = 0;

    for (const comment of group.comments) {
      const commentDoc = {
        localId: comment.id,
        postId,
        userId: comment.userId,
        text: comment.text,
        createdAt: NOW,
        updatedAt: NOW,
        likesCount: randomLikeCount(),
        repliesCount: comment.replies.length,
        author: authorSnapshot(comment.userId),
      };

      await setDocSafe(firestore, 'comments', comment.id, commentDoc);
      commentCount++;

      // Create some comment likes
      for (const likerUid of [USERS[Math.floor(Math.random() * USERS.length)].uid]) {
        const likeId = `${comment.id}_${likerUid}`;
        commentLikesData.push({
          docId: likeId,
          data: { postId, commentId: comment.id, userId: likerUid, createdAt: NOW },
        });
      }

      for (const reply of comment.replies) {
        const replyDoc = {
          localId: reply.id,
          postId,
          commentId: comment.id,
          userId: reply.userId,
          text: reply.text,
          createdAt: NOW,
          updatedAt: NOW,
          likesCount: randomLikeCount(),
          author: authorSnapshot(reply.userId),
        };

        await setDocSafe(firestore, 'replies', reply.id, replyDoc);

        // Create some reply likes
        for (const likerUid of [USERS[Math.floor(Math.random() * USERS.length)].uid]) {
          const likeId = `${reply.id}_${likerUid}`;
          replyLikesData.push({
            docId: likeId,
            data: { postId, commentId: comment.id, replyId: reply.id, userId: likerUid, createdAt: NOW },
          });
        }
      }

      console.log(`  ✓ ${comment.text.slice(0, 50)}... (${comment.replies.length} replies)`);
    }

    // Update post's commentsCount
    if (commentCount > 0) {
      await firestore.doc(`posts/${postId}`).update({ commentsCount: commentCount });
    }
  }
  console.log();

  // ---- 9. Seed likes ----
  console.log('── Seeding likes ──');

  // Post likes — each post gets likes from random users
  let postLikesCount = 0;
  for (const post of posts) {
    const likers = USERS.filter(() => Math.random() > 0.3); // ~70% of users like each post
    for (const liker of likers) {
      // Skip the post author
      if (liker.uid === post.userId) continue;
      const likeId = `${post.id}_${liker.uid}`;
      await setDocSafe(firestore, 'postLikes', likeId, {
        postId: post.id,
        userId: liker.uid,
        createdAt: NOW,
      });
      postLikesCount++;
    }
    // Update post's likesCount
    const likeCount = likers.filter((l) => l.uid !== post.userId).length;
    if (likeCount > 0) {
      await firestore.doc(`posts/${post.id}`).update({ likesCount: likeCount });
    }
  }
  console.log(`  ✓ ${postLikesCount} post likes`);

  // Comment & reply likes
  for (const like of commentLikesData) {
    await setDocSafe(firestore, 'commentLikes', like.docId, like.data);
  }
  console.log(`  ✓ ${commentLikesData.length} comment likes`);

  for (const like of replyLikesData) {
    await setDocSafe(firestore, 'replyLikes', like.docId, like.data);
  }
  console.log(`  ✓ ${replyLikesData.length} reply likes`);

  // ---- 10. Summary ----
  console.log('\n========================================');
  console.log('  Seed complete!');
  console.log('========================================\n');
  console.log(`  Users:              ${USERS.length}`);
  console.log(`  Posts:              ${posts.length}`);
  console.log(`  Comments:           ${commentsByPost.reduce((a, g) => a + g.comments.length, 0)}`);
  console.log(`  Replies:            ${commentsByPost.reduce((a, g) => a + g.comments.reduce((s, c) => s + c.replies.length, 0), 0)}`);
  console.log(`  Post likes:         ${postLikesCount}`);
  console.log(`  Comment likes:      ${commentLikesData.length}`);
  console.log(`  Reply likes:        ${replyLikesData.length}\n`);
  console.log(`  Login emails:       firstName@example.com`);
  console.log(`  Login password:     password123\n`);
}

main().catch((err) => {
  console.error('\nFatal error:', err);
  process.exit(1);
});

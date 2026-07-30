# Buddy Script — Social Media Feed App

A social media feed application built with **React 19**, **Firebase Auth + Firestore**, and **Vite**. Users can register, log in, create posts with images, comment, reply, toggle likes, and control post visibility — all with an **offline-first** architecture that syncs seamlessly to the cloud.

**Live Demo:** [https://appifylab2.netlify.app/](https://appifylab2.netlify.app/)

---

## Features

### Authentication
- Register with first name, last name, email, and password
- Login with email/password
- Persistent auth session via Firebase Auth
- Form validation with user-friendly error messages
- Protected routes — feed requires login, auth pages redirect when already logged in

### Feed
- **Create posts** with text content and optional images
- **Set privacy** — public (visible to everyone) or private (visible only to you)
- **Like posts** with optimistic UI and background sync
- **Comment on posts** with inline reply support (1-level nesting)
- **Like comments and replies**
- **"Who liked this"** popover — fetches liker profiles from Firestore
- **Infinite scroll** — loads more posts as you scroll

### Offline-First Architecture
- All mutations apply **immediately** to the UI (optimistic updates)
- Changes are **persisted to localStorage** — data survives page refreshes
- Images are saved to **IndexedDB** for offline access
- A **sync queue** (localStorage-backed) tracks all pending operations
- When back online, the **sync processor** drains the queue with retry and backoff
- Retry button on failed posts for manual re-sync

### Image Handling
- Upload images from JPEG/PNG/WebP files (max 2 MB)
- **Client-side resize** to 1250×830 max, JPEG quality 0.85
- Image stored in IndexedDB — displayed immediately in feed
- Background upload to **Cloudinary** — Firestore URL update
- Image fallback chain: Cloudinary URL, IndexedDB blob, static asset

### UI / UX
- Custom CSS with Poppins font, Bootstrap 5 utilities
- Dark mode support (theme class on PageShell)
- **Skeleton loading** cards while data loads
- **Toast notifications** for all actions
- **Online/offline indicator** with reconnect toast
- Responsive design (mobile, tablet, desktop)
- 12 custom SVG icon components

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Build Tool** | Vite 8 |
| **UI Library** | React 19 |
| **Routing** | react-router-dom v7 |
| **Backend** | Firebase Auth + Firestore |
| **Image Upload** | Cloudinary (unsigned preset) |
| **Styling** | Bootstrap 5 + custom CSS |
| **Notifications** | react-toastify |
| **Linting** | oxlint |
| **Font** | Poppins (Google Fonts) |
| **Icons** | Custom SVG components (12 icons) |

---

## Project Structure

```
app/
  index.html                HTML entry point
  package.json
  vite.config.js
  .env.local                Firebase & Cloudinary credentials
  firestore.rules           Security rules
  firestore.indexes.json    Composite indexes
  public/
    _redirects              Netlify SPA routing
    favicon.svg
    icons.svg
  src/
    main.jsx                Entry point
    App.jsx                 BrowserRouter wrapper
    app/
      router.jsx            Route definitions
    config/
      firebase.js           Firebase init
    context/
      AuthContext.jsx       Auth state
      FeedContext.jsx       Feed + sync queue
    pages/
      LoginPage.jsx
      RegistrationPage.jsx
      FeedPage.jsx
    components/
      auth/                 Auth components
      common/               Common components
      feed/                 Feed components
      icons/                SVG icons (12)
    hooks/ (6 hooks)        Form, feed, sync, online, blob
    services/ (8 services)  Auth, CRUD, Cloudinary, Queue
    utils/ (12 utils)       Validation, storage, factories
    assets/
      css/                  Stylesheets
      images/               PNG/SVG assets
      fonts/                Font files
    data/
      json/                 Seed data
      adapters/             Normalization
```

---

## Getting Started

### Prerequisites
- Node.js 20+
- npm

### Installation

```
cd app
npm install
```

### Environment Variables

Create a `.env.local` file with your credentials:

```
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
VITE_CLOUDINARY_UPLOAD_PRESET=your_unsigned_preset
```

### Development & Build

```
npm run dev       # Dev server
npm run build     # Production build to dist/
npm run preview   # Preview production build
npm run lint      # oxlint
```

---

## Deploy to Netlify

1. Connect your GitHub repo to Netlify
2. Settings: Build command: `npm run build`, Publish: `dist`
3. Add all `VITE_*` env vars in Netlify Dashboard > Environment Variables
4. SPA routing via `public/_redirects`

---

## Firestore Schema

| Collection | Doc ID | Purpose |
|-----------|--------|---------|
| users/{uid} | Auth UID | User profiles |
| posts/{postId} | auto | Posts |
| comments/{commentId} | auto | Comments |
| replies/{replyId} | auto | Replies (1 level) |
| postLikes/{postId}_{userId} | composite | Post likes |
| commentLikes/{commentId}_{userId} | composite | Comment likes |
| replyLikes/{replyId}_{userId} | composite | Reply likes |

See `firestore.rules` and `firestore.indexes.json`.

---

## Sync Queue Architecture

All mutations follow: Optimistic UI -> localStorage persist -> queue item -> background sync -> retry/backoff (2s-300s) -> max 5 attempts -> manual retry

Queue types: CREATE_POST, ADD_COMMENT, ADD_REPLY, TOGGLE_POST_LIKE, TOGGLE_COMMENT_LIKE, TOGGLE_REPLY_LIKE, UPDATE_POST_PRIVACY, UPDATE_POST_IMAGE

---

## License

MIT

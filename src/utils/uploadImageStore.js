const DB_NAME = 'buddyScriptImages';
const DB_VERSION = 1;
const STORE_NAME = 'postImages';

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Failed to open image storage.'));
  });
}

/**
 * Save a resized JPEG blob to IndexedDB keyed by the image path.
 * @param {string} key - e.g. "/uploads/post-uuid.jpg"
 * @param {Blob} blob - JPEG blob
 */
export async function saveImage(key, blob) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error('Failed to save image.'));
  });
}

/**
 * Retrieve a JPEG blob from IndexedDB by its path.
 * @param {string} key - e.g. "/uploads/post-uuid.jpg"
 * @returns {Blob|null}
 */
export async function getImage(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(new Error('Failed to retrieve image.'));
  });
}

/**
 * Delete an image from IndexedDB.
 * @param {string} key
 */
export async function deleteImage(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error('Failed to delete image.'));
  });
}

/**
 * Clear all stored uploaded images.
 */
export async function clearAllImages() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error('Failed to clear images.'));
  });
}

/**
 * Generate a virtual upload path for a new post image.
 * @param {string} postId
 * @returns {string}
 */
export function generateImagePath(postId) {
  return `/uploads/${postId}.jpg`;
}

/**
 * Safely parse a JSON value from localStorage.
 * @param {string} key
 * @param {*} fallback
 * @returns {*}
 */
export function safeReadJson(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const parsed = JSON.parse(raw);
    return parsed;
  } catch {
    return fallback;
  }
}

/**
 * Safely serialize and write a value to localStorage.
 * @param {string} key
 * @param {*} value
 * @returns {boolean} true if write succeeded
 */
export function safeWriteJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely remove a key from localStorage.
 * @param {string} key
 */
export function safeRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Silently ignore
  }
}

/**
 * Safely read an array from localStorage.
 * Returns fallback if the stored value is not an array.
 * @param {string} key
 * @param {Array} fallback
 * @returns {Array}
 */
export function safeReadArray(key, fallback = []) {
  const raw = safeReadJson(key);
  return Array.isArray(raw) ? raw : fallback;
}

/**
 * Back up a corrupted value in localStorage before it is overwritten.
 * @param {string} key
 * @param {string} backupSuffix - suffix for the backup key (default '.corrupt')
 */
export function backupCorrupted(key, backupSuffix = '.corrupt') {
  try {
    const raw = localStorage.getItem(key);
    if (raw != null) {
      localStorage.setItem(`${key}${backupSuffix}`, raw);
    }
  } catch {
    // Ignore backup failures
  }
}

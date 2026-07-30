import { auth } from '../config/firebaseAuth';
import { getUserProfile } from './authService';
import currentUserJson from '../data/json/currentUser.json';
import { normalizeUser } from '../data/adapters/userAdapter';

/**
 * Get the current user.
 * If Firebase is authenticated, returns the Firestore profile.
 * Falls back to static JSON for development/demo mode.
 * @returns {Promise<object|null>}
 */
export async function getCurrentUser() {
  // Try Firebase first
  const firebaseUser = auth.currentUser;

  if (firebaseUser) {
    try {
      const profile = await getUserProfile(firebaseUser.uid);
      if (profile) return profile;
    } catch (err) {
      console.warn('Failed to load Firebase profile, falling back to static user:', err);
    }
  }

  // Fallback to static JSON for development/demo
  return normalizeUser(currentUserJson);
}

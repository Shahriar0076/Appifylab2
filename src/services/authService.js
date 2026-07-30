import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

/**
 * Register a new user with Firebase Auth and create their Firestore profile.
 * @param {string} email
 * @param {string} password
 * @param {string} firstName
 * @param {string} lastName
 * @returns {Promise<object>} Firebase Auth user credential
 */
export async function registerUser({ firstName, lastName, email, password }) {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  const userDoc = {
    firstName,
    lastName,
    email,
    avatarColor: '#1890FF',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(doc(db, 'users', user.uid), userDoc);

  return user;
}

/**
 * Log in an existing user.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<object>} Firebase Auth user
 */
export async function loginUser({ email, password }) {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
}

/**
 * Log out the current user.
 */
export async function logoutUser() {
  await signOut(auth);
}

/**
 * Subscribe to Firebase Auth state changes.
 * @param {(firebaseUser: object|null) => void} callback
 * @returns {() => void} Unsubscribe function
 */
export function subscribeToAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Fetch a user's Firestore profile.
 * @param {string} uid
 * @returns {Promise<object|null>} Normalized user object or null
 */
export async function getUserProfile(uid) {
  if (!uid) return null;

  const docSnap = await getDoc(doc(db, 'users', uid));

  if (!docSnap.exists()) return null;

  const data = docSnap.data();

  return {
    id: uid,
    name: `${data.firstName} ${data.lastName}`,
    initials: (data.firstName || '').charAt(0).toUpperCase(),
    avatarColor: data.avatarColor || '#1890FF',
    email: data.email,
    firstName: data.firstName,
    lastName: data.lastName,
  };
}

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { subscribeToAuth, getUserProfile } from '../services/authService';
import { toast } from '../utils/toast';

const AuthContext = createContext(null);

async function loadUserProfileWithRetry(uid, attempts = 6) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const profile = await getUserProfile(uid);
    if (profile) return profile;

    // Registration signs the user in just before its profile document is
    // written, so give that write a short window to become readable.
    if (attempt < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  return null;
}

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    let latestAuthEvent = 0;

    const unsubscribe = subscribeToAuth(async (user) => {
      latestAuthEvent += 1;
      const authEvent = latestAuthEvent;
      setFirebaseUser(user);

      if (user) {
        try {
          const profile = await loadUserProfileWithRetry(user.uid);
          if (authEvent !== latestAuthEvent) return;
          if (!profile) {
            throw new Error('User profile was not found.');
          }
          setCurrentUser(profile);
          setAuthError(null);
        } catch (err) {
          if (authEvent !== latestAuthEvent) return;
          console.error('Failed to load user profile:', err);
          toast.error('Failed to load your profile. Some features may be limited.');
          setAuthError('Failed to load user profile.');
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
        setAuthError(null);
      }

      if (authEvent === latestAuthEvent) {
        setIsAuthLoading(false);
      }
    });

    return () => {
      latestAuthEvent += 1;
      unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      firebaseUser,
      currentUser,
      isAuthLoading,
      isAuthenticated: !!firebaseUser,
      authError,
    }),
    [firebaseUser, currentUser, isAuthLoading, authError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

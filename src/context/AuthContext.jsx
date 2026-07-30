import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { subscribeToAuth, getUserProfile } from '../services/authService';
import { toast } from '../utils/toast';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    const unsubscribe = subscribeToAuth(async (user) => {
      setFirebaseUser(user);

      if (user) {
        try {
          const profile = await getUserProfile(user.uid);
          setCurrentUser(profile);
          setAuthError(null);
        } catch (err) {
          console.error('Failed to load user profile:', err);
          toast.error('Failed to load your profile. Some features may be limited.');
          setAuthError('Failed to load user profile.');
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
        setAuthError(null);
      }

      setIsAuthLoading(false);
    });

    return unsubscribe;
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

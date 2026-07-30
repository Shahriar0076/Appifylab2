import { useEffect, useRef, useState } from 'react';
import { toast } from '../utils/toast';

/**
 * Track navigator online/offline status.
 * @returns {{ isOnline: boolean }}
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const hasMounted = useRef(false);

  // Show offline toast if starting offline
  useEffect(() => {
    if (!navigator.onLine) {
      toast.info("You're offline. Changes will sync when you reconnect.", {
        autoClose: false,
        closeButton: false,
        draggable: false,
        toastId: 'offline-toast',
      });
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (hasMounted.current) {
        toast.dismiss('offline-toast');
        toast.success('Back online!');
      }
    };
    const handleOffline = () => {
      setIsOnline(false);
      if (hasMounted.current) {
        toast.info("You're offline. Changes will sync when you reconnect.", {
          autoClose: false,
          closeButton: false,
          draggable: false,
          toastId: 'offline-toast',
        });
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    hasMounted.current = true;

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline };
}

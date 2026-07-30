import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Manage a blob-derived object URL with automatic cleanup.
 * @returns {{ objectUrl: string|null, setBlob: (blob: Blob|null) => void, clearObjectUrl: () => void }}
 */
export function useObjectUrl() {
  const [objectUrl, setObjectUrl] = useState(null);
  const revokeRef = useRef(null);

  const setBlob = useCallback((blob) => {
    // Revoke previous URL
    if (revokeRef.current) {
      URL.revokeObjectURL(revokeRef.current);
      revokeRef.current = null;
    }

    if (blob) {
      const url = URL.createObjectURL(blob);
      revokeRef.current = url;
      setObjectUrl(url);
    } else {
      setObjectUrl(null);
    }
  }, []);

  const clearObjectUrl = useCallback(() => {
    if (revokeRef.current) {
      URL.revokeObjectURL(revokeRef.current);
      revokeRef.current = null;
    }
    setObjectUrl(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (revokeRef.current) {
        URL.revokeObjectURL(revokeRef.current);
      }
    };
  }, []);

  return { objectUrl, setBlob, clearObjectUrl };
}

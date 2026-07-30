import { createContext, useContext, useMemo, useState } from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useSyncQueueProcessor } from '../hooks/useSyncQueueProcessor';
import { useFeedData } from '../hooks/useFeedData';
import { useFeedActions } from '../hooks/useFeedActions';
import { useAuth } from './AuthContext';

const FeedContext = createContext(null);

export function FeedProvider({ children }) {
  const { currentUser } = useAuth();
  const {
    posts,
    isLoading,
    isFetchingRemote,
    storageWarning,
    hasMoreRemote,
    isLoadingMore,
    setPosts,
    fetchAndMergeRemotePosts,
    loadMoreRemotePosts,
    resetFeed,
  } = useFeedData(currentUser?.id);

  const { isOnline } = useOnlineStatus();
  const [syncStatusMessage, setSyncStatusMessage] = useState('');

  useSyncQueueProcessor({ isOnline, setSyncStatusMessage, setPosts, posts });

  const actions = useFeedActions(setPosts, posts);

  const value = useMemo(
    () => ({
      posts,
      isLoading,
      isFetchingRemote,
      syncStatusMessage,
      isOnline,
      storageWarning,
      hasMoreRemote,
      isLoadingMore,
      ...actions,
      fetchAndMergeRemotePosts,
      loadMoreRemotePosts,
      resetFeed,
    }),
    [
      posts,
      isLoading,
      isFetchingRemote,
      syncStatusMessage,
      isOnline,
      storageWarning,
      hasMoreRemote,
      isLoadingMore,
      actions,
      fetchAndMergeRemotePosts,
      loadMoreRemotePosts,
      resetFeed,
    ]
  );

  return <FeedContext.Provider value={value}>{children}</FeedContext.Provider>;
}

export function useFeed() {
  const context = useContext(FeedContext);

  if (!context) {
    throw new Error('useFeed must be used within a FeedProvider');
  }

  return context;
}

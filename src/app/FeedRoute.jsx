import { FeedProvider } from '../context/FeedContext';
import { FeedPage } from '../pages/FeedPage';

export default function FeedRoute() {
  return (
    <FeedProvider>
      <FeedPage />
    </FeedProvider>
  );
}

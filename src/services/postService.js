import postsJson from '../data/json/posts.json';
import { normalizePosts } from '../data/adapters/postAdapter';

export async function getPosts() {
  return normalizePosts(postsJson);
}

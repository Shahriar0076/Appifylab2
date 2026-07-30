import authPagesJson from '../data/json/authPages.json';
import { normalizeAuthPages } from '../data/adapters/authAdapter';

export async function getAuthPageContent(variant) {
  const pages = normalizeAuthPages(authPagesJson);
  return pages[variant] || null;
}

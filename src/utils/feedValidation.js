/**
 * Validate a new post before creation.
 * @param {object} options
 * @param {string} options.content - Post text content
 * @param {object|null} options.imageBlob - Image blob if any
 * @param {string} options.privacy - 'public' or 'private'
 * @returns {{ valid: boolean, error: string|null }}
 */
export function validatePost({ content, imageBlob, privacy }) {
  const hasContent = content?.trim();
  const hasImage = !!imageBlob;

  if (!hasContent && !hasImage) {
    return { valid: false, error: 'Write something or choose an image.' };
  }

  if (hasContent && content.trim().length > 2000) {
    return { valid: false, error: 'Post text must be 2,000 characters or fewer.' };
  }

  if (privacy && privacy !== 'public' && privacy !== 'private') {
    return { valid: false, error: 'Privacy must be public or private.' };
  }

  return { valid: true, error: null };
}

/**
 * Validate a comment or reply before creation.
 * @param {string} text
 * @param {number} maxLength - Max characters (default 500)
 * @returns {{ valid: boolean, error: string|null }}
 */
export function validateComment(text, maxLength = 500) {
  if (!text?.trim()) {
    return { valid: false, error: 'Comment cannot be empty.' };
  }

  if (text.trim().length > maxLength) {
    return { valid: false, error: `Comment must be ${maxLength} characters or fewer.` };
  }

  return { valid: true, error: null };
}

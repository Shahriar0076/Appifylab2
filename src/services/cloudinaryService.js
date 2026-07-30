import {
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_UPLOAD_PRESET,
} from '../config/cloudinary';

/**
 * Upload a resized JPEG blob to Cloudinary using an unsigned upload preset.
 * @param {Blob} blob - Already-resized JPEG blob
 * @param {object} options
 * @param {string} options.postId - Local post ID for tracking
 * @returns {Promise<{url: string, publicId: string, width: number, height: number, format: string}>}
 */
export async function uploadPostImage(blob, { postId }) {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
    throw new Error('Cloudinary is not configured. Set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET in .env.local');
  }

  const formData = new FormData();
  formData.append('file', blob, `${postId || 'image'}.jpg`);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: 'POST', body: formData }
  );

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(
      `Image upload failed. Your post is saved locally and will retry.${errorBody ? ` (${errorBody})` : ''}`
    );
  }

  const data = await response.json();

  return {
    url: data.secure_url,
    publicId: data.public_id,
    width: data.width,
    height: data.height,
    format: data.format,
  };
}

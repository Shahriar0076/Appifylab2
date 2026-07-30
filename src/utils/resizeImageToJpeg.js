const MAX_WIDTH = 1250;
const MAX_HEIGHT = 830;
const JPEG_QUALITY = 0.85;
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB

export function resizeImageToJpeg(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Scale down proportionally to fit within max dimensions
      if (width > MAX_WIDTH || height > MAX_HEIGHT) {
        const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to create image canvas context.'));
        return;
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to encode image as JPEG.'));
            return;
          }

          if (blob.size > MAX_FILE_SIZE) {
            reject(
              new Error(
                'Resized image still exceeds 2 MB. Please use a smaller or less detailed image.'
              )
            );
            return;
          }

          resolve(blob);
        },
        'image/jpeg',
        JPEG_QUALITY
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to read the image file. It may be corrupted.'));
    };

    img.src = url;
  });
}

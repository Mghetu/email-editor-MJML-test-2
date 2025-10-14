// Base64 image drop handler with MIME/size checks; pluggable for future providers
const MAX_BYTES = 1024 * 1024 * 1.5; // 1.5MB
const ALLOWED = ['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml'];

export async function fileToDataUrl(file) {
  if (!ALLOWED.includes(file.type)) throw new Error('Unsupported image type');
  if (file.size > MAX_BYTES) throw new Error('Image too large (max 1.5MB)');
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('Read error'));
    r.readAsDataURL(file);
  });
}

export const ImageProvider = {
  async handleDrop(files) {
    const inputFiles = Array.from(files);
    return Promise.all(inputFiles.map(fileToDataUrl));
  },
  strategy: 'base64'
};

export default ImageProvider;

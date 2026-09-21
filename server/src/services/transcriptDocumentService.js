import sharp from 'sharp';

export const MAX_FILES = 5;
export const MAX_FILE_BYTES = 8 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 14 * 1024 * 1024;

/**
 * Resizes/re-encodes phone-camera photos (with EXIF rotation applied) to keep
 * documents well under MongoDB's 16MB cap. Falls back to the original bytes
 * if sharp can't decode the format (e.g. HEIC without libheif support).
 */
export async function normalizeUpload(file) {
  if (!file.mimetype.startsWith('image/')) {
    return { buffer: file.buffer, mimetype: file.mimetype };
  }
  try {
    const buffer = await sharp(file.buffer, { failOn: 'none' })
      .rotate()
      .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 78 })
      .toBuffer();
    return { buffer, mimetype: 'image/jpeg' };
  } catch {
    return { buffer: file.buffer, mimetype: file.mimetype };
  }
}

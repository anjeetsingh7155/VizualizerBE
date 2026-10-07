import multer from 'multer';
import { env } from '../config/env';
import { BadRequestError } from '../utils/errors';

export const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

// Some apps label every file as "application/octet-stream". Those are allowed through here
// because the real file contents are always checked afterwards (utils/imageValidation.ts).
const GENERIC_TYPE = 'application/octet-stream';

const upload = multer({
  // Files are kept in memory only long enough to be checked and saved to storage.
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.MAX_UPLOAD_MB * 1024 * 1024,
    files: 2,
    fields: 10,
    fieldSize: 16 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    if (ALLOWED_IMAGE_TYPES.has(file.mimetype) || file.mimetype === GENERIC_TYPE) {
      callback(null, true);
    } else {
      callback(new BadRequestError('Only JPEG, PNG or WEBP images are allowed.', 'UNSUPPORTED_FILE_TYPE'));
    }
  },
});

/** Accepts the two images of a visualization request: textureImage and roomImage. */
export const generationImagesUpload = upload.fields([
  { name: 'textureImage', maxCount: 1 },
  { name: 'roomImage', maxCount: 1 },
]);

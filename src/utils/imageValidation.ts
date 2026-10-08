import { imageSize } from 'image-size';
import { ValidationError } from './errors';

const SUPPORTED = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
} as const;

type SupportedExtension = keyof typeof SUPPORTED;

export interface ValidatedImage {
  buffer: Buffer;
  extension: SupportedExtension;
  contentType: (typeof SUPPORTED)[SupportedExtension];
  width: number;
  height: number;
}

/**
 * Checks the actual file contents (not just the name or declared type):
 * it must really be a JPEG, PNG or WEBP image. There is no minimum or maximum picture size.
 * (The website always converts photos to JPEG before uploading, so any photo works there.)
 */
export function validateImageFile(
  file: Express.Multer.File | undefined,
  field: string,
  label: string,
): ValidatedImage {
  if (!file) {
    throw new ValidationError(`${label} is required.`, { [field]: `${label} is required.` });
  }

  let info: ReturnType<typeof imageSize>;
  try {
    info = imageSize(file.buffer);
  } catch {
    throw new ValidationError(`${label} is not a valid image.`, { [field]: 'This file is not a valid image.' });
  }

  const extension = (info.type === 'jpeg' ? 'jpg' : info.type) as string | undefined;
  if (!extension || !(extension in SUPPORTED)) {
    throw new ValidationError(`${label} must be a JPEG, PNG or WEBP image.`, {
      [field]: 'Only JPEG, PNG or WEBP images are allowed.',
    });
  }

  const { width, height } = info;
  if (!width || !height) {
    throw new ValidationError(`${label} is not a valid image.`, { [field]: 'This file is not a valid image.' });
  }

  const ext = extension as SupportedExtension;
  return { buffer: file.buffer, extension: ext, contentType: SUPPORTED[ext], width, height };
}

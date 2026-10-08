import type { Request, Response } from 'express';
import {
  createTextureSchema,
  listTexturesQuerySchema,
  textureIdSchema,
  updateTextureSchema,
} from '../validators/texture.validators';
import {
  createTexture,
  deleteTexture,
  getTexture,
  listTextures,
  updateTexture,
  type TextureDto,
  type TextureImages,
} from '../services/texture.service';
import { validateImageFile } from '../utils/imageValidation';
import { toAbsoluteUrl } from '../utils/url';
import { sendSuccess } from '../utils/response';
import { UnauthorizedError, ValidationError } from '../utils/errors';

type UploadedFiles = Record<string, Express.Multer.File[] | undefined> | undefined;

/** Stored links like /uploads/... become full links the browser can open. */
function withAbsoluteUrls(req: Request, texture: TextureDto): TextureDto {
  return {
    ...texture,
    imageUrl: toAbsoluteUrl(req, texture.imageUrl) ?? texture.imageUrl,
    thumbnailUrl: toAbsoluteUrl(req, texture.thumbnailUrl) ?? texture.thumbnailUrl,
  };
}

function readImages(req: Request, required: boolean): TextureImages | null {
  const files = req.files as UploadedFiles;
  const image = files?.image?.[0];
  const thumbnail = files?.thumbnail?.[0];

  if (!image && !thumbnail && !required) return null;
  if (!image) throw new ValidationError('Sample image is required.', { image: 'Please choose a sample image.' });
  if (!thumbnail) throw new ValidationError('Preview image is missing.', { image: 'Please choose the image again.' });

  return {
    image: validateImageFile(image, 'image', 'Sample image'),
    thumbnail: validateImageFile(thumbnail, 'thumbnail', 'Preview image'),
  };
}

// Every route below needs a signed-in user (see texture.routes.ts).

export async function listTexturesHandler(req: Request, res: Response) {
  const { category } = listTexturesQuerySchema.parse(req.query);
  const items = await listTextures(category);
  return sendSuccess(res, 200, 'Texture library', { textures: items.map((t) => withAbsoluteUrls(req, t)) });
}

export async function getTextureById(req: Request, res: Response) {
  const { id } = textureIdSchema.parse(req.params);
  const texture = await getTexture(id);
  return sendSuccess(res, 200, 'Texture', { texture: withAbsoluteUrls(req, texture) });
}

export async function createTextureHandler(req: Request, res: Response) {
  if (!req.userId) throw new UnauthorizedError();
  const input = createTextureSchema.parse(req.body ?? {});
  const images = readImages(req, true);
  const texture = await createTexture(input, images!, req.userId);
  return sendSuccess(res, 201, 'Sample added to the library', { texture: withAbsoluteUrls(req, texture) });
}

export async function updateTextureHandler(req: Request, res: Response) {
  const { id } = textureIdSchema.parse(req.params);
  const input = updateTextureSchema.parse(req.body ?? {});
  const images = readImages(req, false);
  const texture = await updateTexture(id, input, images);
  return sendSuccess(res, 200, 'Sample updated', { texture: withAbsoluteUrls(req, texture) });
}

export async function deleteTextureHandler(req: Request, res: Response) {
  const { id } = textureIdSchema.parse(req.params);
  await deleteTexture(id);
  return sendSuccess(res, 200, 'Sample deleted');
}

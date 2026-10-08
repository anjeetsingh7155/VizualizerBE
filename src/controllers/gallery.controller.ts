import type { Request, Response } from 'express';
import { galleryIdSchema, galleryQuerySchema } from '../validators/gallery.validators';
import {
  getGalleryItem,
  listGallery,
  listSaved,
  saveItem,
  unsaveItem,
  type GalleryItemDto,
} from '../services/gallery.service';
import { toAbsoluteUrl } from '../utils/url';
import { sendSuccess } from '../utils/response';
import { UnauthorizedError } from '../utils/errors';

/** Stored links like /uploads/... become full links the phone can open. */
function withAbsoluteUrls(req: Request, item: GalleryItemDto): GalleryItemDto {
  return {
    ...item,
    textureImageUrl: toAbsoluteUrl(req, item.textureImageUrl) ?? item.textureImageUrl,
    images: item.images.map((img) => ({ ...img, imageUrl: toAbsoluteUrl(req, img.imageUrl) ?? img.imageUrl })),
  };
}

// ---------- Anyone (guests too) ----------

export async function gallery(req: Request, res: Response) {
  const { page } = galleryQuerySchema.parse(req.query);
  const { items, hasMore } = await listGallery(page, req.userId);
  return sendSuccess(res, 200, 'Gallery', { items: items.map((i) => withAbsoluteUrls(req, i)), page, hasMore });
}

export async function galleryItem(req: Request, res: Response) {
  const { id } = galleryIdSchema.parse(req.params);
  const item = await getGalleryItem(id, req.userId);
  return sendSuccess(res, 200, 'Visualization', { item: withAbsoluteUrls(req, item) });
}

// ---------- Signed-in users only ----------

function userIdOf(req: Request): string {
  if (!req.userId) throw new UnauthorizedError('Please sign in to save samples.');
  return req.userId;
}

export async function saved(req: Request, res: Response) {
  const items = await listSaved(userIdOf(req));
  return sendSuccess(res, 200, 'Saved', { items: items.map((i) => withAbsoluteUrls(req, i)) });
}

export async function save(req: Request, res: Response) {
  const { id } = galleryIdSchema.parse(req.params);
  const item = await saveItem(userIdOf(req), id);
  return sendSuccess(res, 200, 'Saved', { item: withAbsoluteUrls(req, item) });
}

export async function unsave(req: Request, res: Response) {
  const { id } = galleryIdSchema.parse(req.params);
  await unsaveItem(userIdOf(req), id);
  return sendSuccess(res, 200, 'Removed from saved');
}

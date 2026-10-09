import type { Request, Response } from 'express';
import { createGenerationSchema, generationIdSchema } from '../validators/generation.validators';
import {
  createGeneration,
  deleteGeneration,
  getGeneration,
  listGenerations,
  retryFailedImages,
  type GenerationDto,
} from '../services/generation.service';
import { toAbsoluteUrl } from '../utils/url';
import { sendSuccess } from '../utils/response';
import { UnauthorizedError } from '../utils/errors';

/** Stored links like /uploads/... become full links the browser can open. */
function withAbsoluteUrls(req: Request, g: GenerationDto): GenerationDto {
  return {
    ...g,
    textureImageUrl: toAbsoluteUrl(req, g.textureImageUrl) ?? g.textureImageUrl,
    images: g.images.map((img) => ({ ...img, imageUrl: toAbsoluteUrl(req, img.imageUrl) })),
  };
}

function userIdOf(req: Request): string {
  if (!req.userId) throw new UnauthorizedError();
  return req.userId;
}

export async function create(req: Request, res: Response) {
  const input = createGenerationSchema.parse(req.body ?? {});
  const generation = await createGeneration(userIdOf(req), input);
  return sendSuccess(res, 202, 'Your visualizations are being created', { generation: withAbsoluteUrls(req, generation) });
}

export async function list(req: Request, res: Response) {
  const items = await listGenerations(userIdOf(req));
  return sendSuccess(res, 200, 'Your visualizations', { generations: items.map((g) => withAbsoluteUrls(req, g)) });
}

export async function getOne(req: Request, res: Response) {
  const { id } = generationIdSchema.parse(req.params);
  const generation = await getGeneration(userIdOf(req), id);
  return sendSuccess(res, 200, 'Visualization', { generation: withAbsoluteUrls(req, generation) });
}

export async function retry(req: Request, res: Response) {
  const { id } = generationIdSchema.parse(req.params);
  const generation = await retryFailedImages(userIdOf(req), id);
  return sendSuccess(res, 202, 'Trying again', { generation: withAbsoluteUrls(req, generation) });
}

export async function remove(req: Request, res: Response) {
  const { id } = generationIdSchema.parse(req.params);
  await deleteGeneration(userIdOf(req), id);
  return sendSuccess(res, 200, 'Visualization deleted');
}

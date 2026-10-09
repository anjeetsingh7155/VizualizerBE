import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../config/database';
import {
  generationImages,
  generations,
  textures,
  type GenerationImageRow,
  type GenerationRow,
  type TextureRow,
  type GenerationStatus,
  type SpaceType,
} from '../db/schema';
import { storage } from './storage';
import { AiProviderError, downloadImage, generateImage, isAiConfigured } from './ai/fal.client';
import { SPACE_ORDER, buildMasterPrompt } from './ai/prompts';
import { AppError, NotFoundError, ConflictError, ForbiddenError } from '../utils/errors';

/** How many of the six pictures are created at the same time. */
const PARALLEL_IMAGES = 3;

export interface GenerationImageDto {
  id: string;
  space: SpaceType;
  status: GenerationStatus;
  imageUrl: string | null;
  errorMessage: string | null;
}

/** What the website receives (links are made absolute in the controller). */
export interface GenerationDto {
  id: string;
  textureId: string | null;
  textureName: string;
  textureImageUrl: string;
  prompt: string;
  status: GenerationStatus;
  createdAt: string;
  images: GenerationImageDto[];
  /** True when the signed-in person created it (only they can retry pictures or delete it). */
  isMine: boolean;
  /** The sample's type and price (empty if the sample was deleted from the library). */
  textureCategory: TextureRow['category'] | null;
  texturePriceAmount: number | null;
  texturePriceUnit: TextureRow['priceUnit'] | null;
}

type GenerationWithTexture = GenerationRow & { texture?: TextureRow | null };

function toDto(row: GenerationWithTexture, images: GenerationImageRow[], viewerId: string): GenerationDto {
  return {
    isMine: row.userId === viewerId,
    textureCategory: row.texture?.category ?? null,
    texturePriceAmount: row.texture?.priceAmount != null ? Number(row.texture.priceAmount) : null,
    texturePriceUnit: row.texture?.priceUnit ?? null,
    id: row.id,
    textureId: row.textureId,
    textureName: row.textureName,
    textureImageUrl: row.textureImageUrl,
    prompt: row.userPrompt,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    images: [...images]
      .sort((a, b) => a.position - b.position)
      .map((img) => ({
        id: img.id,
        space: img.space,
        status: img.status,
        imageUrl: img.imageUrl,
        errorMessage: img.errorMessage,
      })),
  };
}

const MIME_BY_EXT: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

function log(message: string) {
  console.log(`[generation] ${message}`);
}

/** Only the person who created a visualization may change it (retry pictures, delete). */
async function findOwned(userId: string, id: string) {
  const row = await db.query.generations.findFirst({
    where: eq(generations.id, id),
    with: { images: true },
  });
  if (!row) throw new NotFoundError('Visualization not found.');
  if (row.userId !== userId) throw new ForbiddenError('Only the person who created this visualization can change it.');
  return row;
}

// ---------------- Reading ----------------

/** Website History: everyone's visualizations, newest first (each says whether it is yours). */
export async function listGenerations(userId: string): Promise<GenerationDto[]> {
  const rows = await db.query.generations.findMany({
    orderBy: [desc(generations.createdAt)],
    limit: 100,
    with: { images: true, texture: true },
  });
  return rows.map((row) => toDto(row, row.images, userId));
}

/** Any signed-in person can open any visualization. */
export async function getGeneration(userId: string, id: string): Promise<GenerationDto> {
  const row = await db.query.generations.findFirst({ where: eq(generations.id, id), with: { images: true, texture: true } });
  if (!row) throw new NotFoundError('Visualization not found.');
  return toDto(row, row.images, userId);
}

// ---------------- Creating ----------------

export async function createGeneration(
  userId: string,
  input: { textureId: string; prompt: string; spaces?: SpaceType[] },
) {
  // The chosen spaces, always in the usual order (all six if none were sent).
  const chosen = input.spaces?.length ? SPACE_ORDER.filter((s) => input.spaces!.includes(s)) : SPACE_ORDER;

  if (!isAiConfigured()) {
    throw new AppError(
      503,
      'AI_NOT_CONFIGURED',
      'AI image generation is not set up yet. Add your fal.ai key as FAL_KEY in server/.env and restart the server.',
    );
  }

  const texture = await db.query.textures.findFirst({ where: eq(textures.id, input.textureId) });
  if (!texture) throw new NotFoundError('This sample no longer exists. Please choose another one.');

  // Keep our own copy of the sample's small picture, so History still shows it if the sample is deleted.
  const thumbExt = texture.thumbnailKey.split('.').pop() ?? 'jpg';
  const thumbCopy = await storage.save({
    buffer: await storage.read(texture.thumbnailKey),
    extension: thumbExt,
    contentType: MIME_BY_EXT[thumbExt] ?? 'image/jpeg',
    folder: 'generation-samples',
  });

  const sample = { name: texture.name, category: texture.category };
  let created: GenerationRow;
  try {
    created = await db.transaction(async (tx) => {
      const [generation] = await tx
        .insert(generations)
        .values({
          userId,
          textureId: texture.id,
          textureName: texture.name,
          textureImageUrl: thumbCopy.url,
          textureImageKey: thumbCopy.key,
          userPrompt: input.prompt,
          status: 'processing',
        })
        .returning();
      if (!generation) throw new Error('Generation insert returned no row');
      await tx.insert(generationImages).values(
        chosen.map((space, position) => ({
          generationId: generation.id,
          space,
          position,
          masterPrompt: buildMasterPrompt(space, sample, input.prompt),
        })),
      );
      return generation;
    });
  } catch (error) {
    await storage.delete(thumbCopy.key).catch(() => undefined);
    throw error;
  }

  // The pictures are created in the background; the website checks progress.
  void runImages(created.id, texture.imageKey);
  return getGeneration(userId, created.id);
}

/** Retries one picture that failed. */
/**
 * "Try Again": creates every picture of this visualization that failed, all at once.
 * Pictures that already worked are kept as they are.
 */
export async function retryFailedImages(userId: string, generationId: string) {
  if (!isAiConfigured()) {
    throw new AppError(503, 'AI_NOT_CONFIGURED', 'AI image generation is not set up yet (FAL_KEY is missing).');
  }
  const generation = await findOwned(userId, generationId);
  const failed = generation.images.filter((img) => img.status === 'failed');
  if (failed.length === 0) throw new ConflictError('There are no failed pictures to create again.');

  // The original sample is needed to try again.
  const texture = generation.textureId
    ? await db.query.textures.findFirst({ where: eq(textures.id, generation.textureId) })
    : undefined;
  if (!texture) {
    throw new AppError(410, 'SAMPLE_DELETED', 'The sample used for this visualization was deleted, so these pictures cannot be created again.');
  }

  const ids = failed.map((img) => img.id);
  await db
    .update(generationImages)
    .set({ status: 'pending', errorMessage: null })
    .where(inArray(generationImages.id, ids));
  await db.update(generations).set({ status: 'processing' }).where(eq(generations.id, generation.id));

  void runImages(generation.id, texture.imageKey, ids);
  return getGeneration(userId, generation.id);
}

// ---------------- Background work ----------------

async function sampleAsDataUri(imageKey: string): Promise<string> {
  const buffer = await storage.read(imageKey);
  const ext = imageKey.split('.').pop()?.toLowerCase() ?? 'jpg';
  return `data:${MIME_BY_EXT[ext] ?? 'image/jpeg'};base64,${buffer.toString('base64')}`;
}

async function createOneImage(image: GenerationImageRow, sampleUri: string) {
  await db.update(generationImages).set({ status: 'processing' }).where(eq(generationImages.id, image.id));
  try {
    const result = await generateImage({ prompt: image.masterPrompt, imageUrls: [sampleUri] });
    const file = await downloadImage(result.imageUrl);
    const stored = await storage.save({ ...file, folder: 'generated' });
    const [updated] = await db
      .update(generationImages)
      .set({ status: 'completed', imageUrl: stored.url, imageKey: stored.key, providerRequestId: result.requestId })
      .where(eq(generationImages.id, image.id))
      .returning();
    // The visualization was deleted while this picture was being made: remove the file again.
    if (!updated) await storage.delete(stored.key).catch(() => undefined);
    log(`${image.space} done (${result.requestId})`);
  } catch (error) {
    const userMessage =
      error instanceof AiProviderError ? error.userMessage : 'Something went wrong creating this picture. Please try again.';
    console.error(`[generation] ${image.space} failed: ${error instanceof Error ? error.message : String(error)}`);
    await db
      .update(generationImages)
      .set({ status: 'failed', errorMessage: userMessage })
      .where(eq(generationImages.id, image.id));
  }
}

/** Sets the overall status once no picture is waiting any more. */
async function refreshStatus(generationId: string) {
  const images = await db.select().from(generationImages).where(eq(generationImages.generationId, generationId));
  if (images.some((img) => img.status === 'pending' || img.status === 'processing')) return;
  const status: GenerationStatus = images.some((img) => img.status === 'completed') ? 'completed' : 'failed';
  await db.update(generations).set({ status }).where(eq(generations.id, generationId));
}

async function runImages(generationId: string, sampleImageKey: string, onlyImageIds?: string[]) {
  try {
    const images = await db
      .select()
      .from(generationImages)
      .where(
        and(
          eq(generationImages.generationId, generationId),
          onlyImageIds ? inArray(generationImages.id, onlyImageIds) : eq(generationImages.status, 'pending'),
        ),
      )
      .orderBy(asc(generationImages.position));

    let sampleUri: string;
    try {
      sampleUri = await sampleAsDataUri(sampleImageKey);
    } catch (error) {
      console.error(`[generation] could not read sample ${sampleImageKey}:`, error);
      await db
        .update(generationImages)
        .set({ status: 'failed', errorMessage: 'The sample photo could not be read. Please try again.' })
        .where(inArray(generationImages.id, images.map((img) => img.id)));
      return;
    }

    log(`${generationId}: creating ${images.length} picture(s)`);
    // A few pictures at a time: faster than one by one, gentler than all at once.
    const queue = [...images];
    const worker = async () => {
      for (let next = queue.shift(); next; next = queue.shift()) await createOneImage(next, sampleUri);
    };
    await Promise.all(Array.from({ length: Math.min(PARALLEL_IMAGES, queue.length) }, worker));
  } catch (error) {
    console.error(`[generation] ${generationId} stopped unexpectedly:`, error);
  } finally {
    await refreshStatus(generationId).catch((error) => console.error('[generation] status update failed:', error));
  }
}

/**
 * Pictures that were still being made when the server stopped can't continue,
 * so they are marked as failed (the user can press "Try again").
 */
export async function markInterruptedGenerations() {
  const stuck = await db
    .update(generationImages)
    .set({ status: 'failed', errorMessage: 'Stopped because the server restarted. Please try again.' })
    .where(inArray(generationImages.status, ['pending', 'processing']))
    .returning({ generationId: generationImages.generationId });
  const ids = [...new Set(stuck.map((s) => s.generationId))];
  for (const id of ids) await refreshStatus(id);
  if (ids.length) log(`marked ${stuck.length} interrupted picture(s) in ${ids.length} visualization(s) as failed`);
}

// ---------------- Deleting ----------------

export async function deleteGeneration(userId: string, id: string) {
  const row = await findOwned(userId, id);
  await db.delete(generations).where(eq(generations.id, row.id));
  const keys = [row.textureImageKey, ...row.images.map((img) => img.imageKey)].filter((k): k is string => Boolean(k));
  for (const key of keys) {
    await storage.delete(key).catch((error: unknown) => console.error(`Could not delete file ${key}:`, error));
  }
}

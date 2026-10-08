import { asc, eq } from 'drizzle-orm';
import { db } from '../config/database';
import { textures, type TextureCategory, type TextureRow } from '../db/schema';
import { storage, type StoredFile } from './storage';
import type { ValidatedImage } from '../utils/imageValidation';
import type { CreateTextureInput, UpdateTextureInput } from '../validators/texture.validators';
import { NotFoundError } from '../utils/errors';

export interface TextureImages {
  image: ValidatedImage;
  thumbnail: ValidatedImage;
}

/** What the website receives (links are made absolute in the controller). */
export interface TextureDto {
  id: string;
  name: string;
  category: TextureCategory;
  size: string | null;
  finish: string | null;
  priceAmount: number | null;
  priceUnit: TextureRow['priceUnit'];
  imageUrl: string;
  thumbnailUrl: string;
  createdAt: string;
}

export function toTextureDto(row: TextureRow): TextureDto {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    size: row.size,
    finish: row.finish,
    priceAmount: row.priceAmount === null ? null : Number(row.priceAmount),
    priceUnit: row.priceUnit,
    imageUrl: row.imageUrl,
    thumbnailUrl: row.thumbnailUrl,
    createdAt: row.createdAt.toISOString(),
  };
}

async function saveImages({ image, thumbnail }: TextureImages): Promise<[StoredFile, StoredFile]> {
  const full = await storage.save({ ...image, folder: 'textures' });
  try {
    const thumb = await storage.save({ ...thumbnail, folder: 'texture-thumbnails' });
    return [full, thumb];
  } catch (error) {
    await storage.delete(full.key).catch(() => undefined);
    throw error;
  }
}

async function deleteFiles(...keys: string[]) {
  for (const key of keys) {
    await storage.delete(key).catch((error: unknown) => {
      console.error(`[storage] could not delete ${key}:`, error instanceof Error ? error.message : error);
    });
  }
}

/** Every sample in the library, grouped by category then name. */
export async function listTextures(category?: TextureCategory) {
  const rows = await db
    .select()
    .from(textures)
    .where(category ? eq(textures.category, category) : undefined)
    .orderBy(asc(textures.category), asc(textures.name));
  return rows.map(toTextureDto);
}

export async function getTexture(id: string) {
  const row = await db.query.textures.findFirst({ where: eq(textures.id, id) });
  if (!row) throw new NotFoundError('Sample not found.');
  return toTextureDto(row);
}

export async function createTexture(input: CreateTextureInput, images: TextureImages, userId: string) {
  const [full, thumb] = await saveImages(images);
  try {
    const [row] = await db
      .insert(textures)
      .values({
        ...input,
        imageUrl: full.url,
        imageKey: full.key,
        thumbnailUrl: thumb.url,
        thumbnailKey: thumb.key,
        createdBy: userId,
      })
      .returning();
    if (!row) throw new Error('Texture insert returned no row');
    return toTextureDto(row);
  } catch (error) {
    // Don't leave orphan files if the database save failed.
    await deleteFiles(full.key, thumb.key);
    throw error;
  }
}

export async function updateTexture(id: string, input: UpdateTextureInput, images: TextureImages | null) {
  const existing = await db.query.textures.findFirst({ where: eq(textures.id, id) });
  if (!existing) throw new NotFoundError('Sample not found.');

  let newFiles: [StoredFile, StoredFile] | null = null;
  if (images) newFiles = await saveImages(images);

  try {
    const [row] = await db
      .update(textures)
      .set({
        ...input,
        ...(newFiles
          ? {
              imageUrl: newFiles[0].url,
              imageKey: newFiles[0].key,
              thumbnailUrl: newFiles[1].url,
              thumbnailKey: newFiles[1].key,
            }
          : {}),
      })
      .where(eq(textures.id, id))
      .returning();
    if (!row) throw new NotFoundError('Sample not found.');

    // The image was replaced: remove the old files.
    if (newFiles) await deleteFiles(existing.imageKey, existing.thumbnailKey);
    return toTextureDto(row);
  } catch (error) {
    if (newFiles) await deleteFiles(newFiles[0].key, newFiles[1].key);
    throw error;
  }
}

export async function deleteTexture(id: string) {
  const [row] = await db.delete(textures).where(eq(textures.id, id)).returning();
  if (!row) throw new NotFoundError('Sample not found.');
  await deleteFiles(row.imageKey, row.thumbnailKey);
}

import { and, desc, eq, exists, inArray } from 'drizzle-orm';
import { db } from '../config/database';
import { bookmarks, generationImages, generations, type SpaceType } from '../db/schema';
import { ConflictError, NotFoundError } from '../utils/errors';

/**
 * The public gallery shown in the mobile app: every visualization created on the website
 * that has at least one finished picture. Only finished pictures are shown, and no
 * personal details (name, email) of the person who created it are included.
 */

export interface GalleryImageDto {
  id: string;
  space: SpaceType;
  imageUrl: string;
}

export interface GalleryItemDto {
  id: string;
  textureName: string;
  textureImageUrl: string;
  style: string;
  createdAt: string;
  images: GalleryImageDto[];
  /** True when the signed-in person has saved this item (always false for guests). */
  saved: boolean;
}

export const GALLERY_PAGE_SIZE = 20;

const hasFinishedPicture = exists(
  db
    .select({ one: generationImages.id })
    .from(generationImages)
    .where(and(eq(generationImages.generationId, generations.id), eq(generationImages.status, 'completed'))),
);

/** Adds the finished pictures and the "saved" flag to a list of visualizations (keeps their order). */
async function toItems(rows: (typeof generations.$inferSelect)[], userId?: string): Promise<GalleryItemDto[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  const images = await db
    .select()
    .from(generationImages)
    .where(and(inArray(generationImages.generationId, ids), eq(generationImages.status, 'completed')))
    .orderBy(generationImages.position);

  const savedIds = new Set<string>();
  if (userId) {
    const saved = await db
      .select({ generationId: bookmarks.generationId })
      .from(bookmarks)
      .where(and(eq(bookmarks.userId, userId), inArray(bookmarks.generationId, ids)));
    for (const s of saved) savedIds.add(s.generationId);
  }

  return rows.map((row) => ({
    id: row.id,
    textureName: row.textureName,
    textureImageUrl: row.textureImageUrl,
    style: row.userPrompt,
    createdAt: row.createdAt.toISOString(),
    images: images
      .filter((img) => img.generationId === row.id && img.imageUrl)
      .map((img) => ({ id: img.id, space: img.space, imageUrl: img.imageUrl! })),
    saved: savedIds.has(row.id),
  }));
}

/** Newest first, 20 per page. */
export async function listGallery(page: number, userId?: string) {
  const rows = await db
    .select()
    .from(generations)
    .where(hasFinishedPicture)
    .orderBy(desc(generations.createdAt), desc(generations.id))
    .limit(GALLERY_PAGE_SIZE + 1)
    .offset((page - 1) * GALLERY_PAGE_SIZE);
  const hasMore = rows.length > GALLERY_PAGE_SIZE;
  return { items: await toItems(rows.slice(0, GALLERY_PAGE_SIZE), userId), hasMore };
}

export async function getGalleryItem(id: string, userId?: string) {
  const [row] = await db
    .select()
    .from(generations)
    .where(and(eq(generations.id, id), hasFinishedPicture));
  if (!row) throw new NotFoundError('This visualization is no longer available.');
  const [item] = await toItems([row], userId);
  return item!;
}

// ---------------- Saved items (bookmarks) ----------------

/** The signed-in person's saved items, most recently saved first. */
export async function listSaved(userId: string) {
  const rows = await db
    .select({ generation: generations })
    .from(bookmarks)
    .innerJoin(generations, eq(bookmarks.generationId, generations.id))
    .where(and(eq(bookmarks.userId, userId), hasFinishedPicture))
    .orderBy(desc(bookmarks.createdAt));
  return toItems(
    rows.map((r) => r.generation),
    userId,
  );
}

/** Saves an item (saving it twice is fine — it stays saved once). */
export async function saveItem(userId: string, generationId: string) {
  const item = await getGalleryItem(generationId, userId).catch(() => null);
  if (!item) throw new NotFoundError('This visualization is no longer available.');
  try {
    await db.insert(bookmarks).values({ userId, generationId }).onConflictDoNothing();
  } catch {
    throw new ConflictError('Could not save this item. Please try again.');
  }
  return { ...item, saved: true };
}

export async function unsaveItem(userId: string, generationId: string) {
  await db.delete(bookmarks).where(and(eq(bookmarks.userId, userId), eq(bookmarks.generationId, generationId)));
}

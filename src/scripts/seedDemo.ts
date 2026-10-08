/**
 * Adds DEMO samples and DEMO room pictures for testing (no AI is used, nothing is charged).
 *
 *   npm run seed:demo            → adds 4 demo samples, each with 6 demo room pictures
 *   npm run seed:demo -- --remove → removes all demo samples, pictures and saved bookmarks again
 *
 * Demo items belong to a hidden account (demo@vizualizer.local) so they are easy to remove,
 * and every picture says "DEMO IMAGE" in the corner.
 */
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { db, pool } from '../config/database';
import { generationImages, generations, textures, users, type SpaceType, type TextureCategory } from '../db/schema';
import { storage } from '../services/storage';
import { hashPassword } from '../utils/password';

const DEMO_EMAIL = 'demo@vizualizer.local';
const DATA_DIR = path.resolve(__dirname, '../../demo-data');
const SPACE_ORDER: SpaceType[] = ['living_room_floor', 'bedroom_floor', 'kitchen', 'bathroom', 'staircase', 'feature_wall'];

interface DemoSample {
  name: string;
  category: TextureCategory;
  priceAmount: number;
  priceUnit: 'sq_ft' | 'sq_m' | 'piece' | 'box';
  image: string;
  thumbnail: string;
  rooms: Record<SpaceType, string>;
}

async function saveJpg(file: string, folder: string) {
  const buffer = await readFile(path.join(DATA_DIR, file));
  return storage.save({ buffer, extension: 'jpg', contentType: 'image/jpeg', folder });
}

async function findDemoUser() {
  return db.query.users.findFirst({ where: eq(users.email, DEMO_EMAIL) });
}

async function remove() {
  const demo = await findDemoUser();
  if (!demo) {
    console.log('No demo data found — nothing to remove.');
    return;
  }
  const demoTextures = await db.select().from(textures).where(eq(textures.createdBy, demo.id));
  const demoGenerations = await db.query.generations.findMany({ where: eq(generations.userId, demo.id), with: { images: true } });

  const keys = [
    ...demoTextures.flatMap((t) => [t.imageKey, t.thumbnailKey]),
    ...demoGenerations.flatMap((g) => [g.textureImageKey, ...g.images.map((i) => i.imageKey)]),
  ].filter((k): k is string => Boolean(k));

  await db.delete(textures).where(eq(textures.createdBy, demo.id));
  // Deleting the demo account also deletes its visualizations, pictures and anyone's bookmarks of them.
  await db.delete(users).where(eq(users.id, demo.id));
  for (const key of keys) await storage.delete(key).catch(() => undefined);

  console.log(`Removed ${demoTextures.length} demo samples and ${demoGenerations.length} demo visualizations.`);
}

async function add() {
  if (await findDemoUser()) {
    console.log('Demo data is already added. To add it again, first run: npm run seed:demo -- --remove');
    return;
  }
  const samples = JSON.parse(await readFile(path.join(DATA_DIR, 'manifest.json'), 'utf8')) as DemoSample[];

  const [demo] = await db
    .insert(users)
    .values({
      name: 'Vizualizer Demo',
      email: DEMO_EMAIL,
      // A random password nobody knows: this account is only an owner for demo items.
      passwordHash: await hashPassword(randomBytes(24).toString('hex')),
    })
    .returning();
  if (!demo) throw new Error('Could not create the demo account');

  for (const [index, sample] of samples.entries()) {
    const image = await saveJpg(sample.image, 'textures');
    const thumb = await saveJpg(sample.thumbnail, 'texture-thumbnails');
    const [texture] = await db
      .insert(textures)
      .values({
        name: sample.name,
        category: sample.category,
        priceAmount: sample.priceAmount.toFixed(2),
        priceUnit: sample.priceUnit,
        imageUrl: image.url,
        imageKey: image.key,
        thumbnailUrl: thumb.url,
        thumbnailKey: thumb.key,
        createdBy: demo.id,
      })
      .returning();
    if (!texture) throw new Error('Could not add a demo sample');

    const sampleCopy = await saveJpg(sample.thumbnail, 'generation-samples');
    // Slightly different times so the gallery shows them in a stable order.
    const createdAt = new Date(Date.now() - index * 60_000);
    const [generation] = await db
      .insert(generations)
      .values({
        userId: demo.id,
        textureId: texture.id,
        textureName: texture.name,
        textureImageUrl: sampleCopy.url,
        textureImageKey: sampleCopy.key,
        userPrompt: '',
        status: 'completed',
        createdAt,
      })
      .returning();
    if (!generation) throw new Error('Could not add a demo visualization');

    for (const [position, space] of SPACE_ORDER.entries()) {
      const picture = await saveJpg(sample.rooms[space], 'generated');
      await db.insert(generationImages).values({
        generationId: generation.id,
        space,
        position,
        status: 'completed',
        masterPrompt: 'DEMO picture for testing — not created by AI.',
        imageUrl: picture.url,
        imageKey: picture.key,
      });
    }
    console.log(`Added: ${sample.name} (6 demo room pictures)`);
  }
  console.log('Done. Open the website sample list or the mobile app gallery to see the demo items.');
}

async function main() {
  try {
    if (process.argv.includes('--remove')) await remove();
    else await add();
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error('Demo data step failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

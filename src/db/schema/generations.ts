import { index, integer, pgEnum, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from './users';
import { textures } from './textures';

export const generationStatusEnum = pgEnum('generation_status', ['pending', 'processing', 'completed', 'failed']);

/** The six scenes created for every visualization. */
export const spaceTypeEnum = pgEnum('space_type', [
  'living_room_floor',
  'bedroom_floor',
  'kitchen',
  'bathroom',
  'staircase',
  'feature_wall',
]);

/** One visualization request: a sample + an optional style text → six images. */
export const generations = pgTable(
  'generations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Deleting a user also deletes their generations (ON DELETE CASCADE).
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // The sample used. A copy of its name and small picture is kept, so History still
    // shows them even if the sample is deleted from the library later.
    textureId: uuid('texture_id').references(() => textures.id, { onDelete: 'set null' }),
    textureName: varchar('texture_name', { length: 120 }).notNull(),
    textureImageUrl: text('texture_image_url').notNull(),
    textureImageKey: text('texture_image_key'),
    userPrompt: text('user_prompt').notNull().default(''),
    status: generationStatusEnum('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // Speeds up "show my visualizations, newest first" (the History screen).
    index('generations_user_id_created_at_idx').on(table.userId, table.createdAt.desc()),
  ],
);

/** One generated picture (one per space) belonging to a visualization. */
export const generationImages = pgTable(
  'generation_images',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    generationId: uuid('generation_id')
      .notNull()
      .references(() => generations.id, { onDelete: 'cascade' }),
    space: spaceTypeEnum('space').notNull(),
    // Keeps the six pictures in the same order every time.
    position: integer('position').notNull(),
    status: generationStatusEnum('status').notNull().default('pending'),
    // The full instruction sent to the AI for this picture.
    masterPrompt: text('master_prompt').notNull(),
    // Only links are stored (the image files live in storage).
    imageUrl: text('image_url'),
    imageKey: text('image_key'),
    errorMessage: text('error_message'),
    // fal.ai's id for the request (useful when checking their dashboard).
    providerRequestId: text('provider_request_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index('generation_images_generation_id_idx').on(table.generationId)],
);

export type GenerationRow = typeof generations.$inferSelect;
export type NewGenerationRow = typeof generations.$inferInsert;
export type GenerationImageRow = typeof generationImages.$inferSelect;
export type GenerationStatus = (typeof generationStatusEnum.enumValues)[number];
export type SpaceType = (typeof spaceTypeEnum.enumValues)[number];

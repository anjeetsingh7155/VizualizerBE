import { index, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

export const generationStatusEnum = pgEnum('generation_status', ['pending', 'processing', 'completed', 'failed']);

export const generations = pgTable(
  'generations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Deleting a user also deletes their generations (ON DELETE CASCADE).
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // Only image links (URLs) are stored here, never the image files themselves.
    textureImageUrl: text('texture_image_url').notNull(),
    roomImageUrl: text('room_image_url').notNull(),
    generatedImageUrl: text('generated_image_url'),
    userPrompt: text('user_prompt').notNull(),
    masterPrompt: text('master_prompt'),
    status: generationStatusEnum('status').notNull().default('pending'),
    errorMessage: text('error_message'),
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

export type GenerationRow = typeof generations.$inferSelect;
export type NewGenerationRow = typeof generations.$inferInsert;
export type GenerationStatus = (typeof generationStatusEnum.enumValues)[number];

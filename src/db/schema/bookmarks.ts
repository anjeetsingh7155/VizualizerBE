import { index, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';
import { generations } from './generations';

/** A visualization a user saved (bookmarked) in the mobile app. Each one can be saved once per user. */
export const bookmarks = pgTable(
  'bookmarks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    generationId: uuid('generation_id')
      .notNull()
      .references(() => generations.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('bookmarks_user_generation_unique').on(table.userId, table.generationId),
    index('bookmarks_user_id_created_at_idx').on(table.userId, table.createdAt.desc()),
  ],
);

export type BookmarkRow = typeof bookmarks.$inferSelect;

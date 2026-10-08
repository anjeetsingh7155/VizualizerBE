import { index, numeric, pgEnum, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from './users';

export const textureCategoryEnum = pgEnum('texture_category', ['granite', 'marble', 'tile', 'wood', 'stone']);
export const priceUnitEnum = pgEnum('price_unit', ['sq_ft', 'sq_m', 'piece', 'box']);

/** The library of surface samples users add with "Upload Surface" and choose from in Step 1. */
export const textures = pgTable(
  'textures',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 120 }).notNull(),
    category: textureCategoryEnum('category').notNull(),
    // e.g. "600 × 1200 mm"
    size: varchar('size', { length: 60 }),
    // e.g. "Polished", "Matt"
    finish: varchar('finish', { length: 40 }),
    // Price in Indian Rupees per unit; empty = not shown.
    priceAmount: numeric('price_amount', { precision: 10, scale: 2 }),
    priceUnit: priceUnitEnum('price_unit').notNull().default('sq_ft'),
    // Only links are stored (the image files live in storage).
    imageUrl: text('image_url').notNull(),
    imageKey: text('image_key').notNull(),
    thumbnailUrl: text('thumbnail_url').notNull(),
    thumbnailKey: text('thumbnail_key').notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index('textures_category_idx').on(table.category)],
);

export type TextureRow = typeof textures.$inferSelect;
export type NewTextureRow = typeof textures.$inferInsert;
export type TextureCategory = (typeof textureCategoryEnum.enumValues)[number];
export type PriceUnit = (typeof priceUnitEnum.enumValues)[number];

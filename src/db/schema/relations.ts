import { relations } from 'drizzle-orm';
import { users } from './users';
import { generationImages, generations } from './generations';
import { textures } from './textures';

// A user has many generations; each generation belongs to one user and has six images.
export const usersRelations = relations(users, ({ many }) => ({
  generations: many(generations),
}));

export const generationsRelations = relations(generations, ({ one, many }) => ({
  user: one(users, { fields: [generations.userId], references: [users.id] }),
  texture: one(textures, { fields: [generations.textureId], references: [textures.id] }),
  images: many(generationImages),
}));

export const generationImagesRelations = relations(generationImages, ({ one }) => ({
  generation: one(generations, { fields: [generationImages.generationId], references: [generations.id] }),
}));

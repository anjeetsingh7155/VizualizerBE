import { relations } from 'drizzle-orm';
import { users } from './users';
import { generations } from './generations';

// A user has many generations; each generation belongs to one user.
export const usersRelations = relations(users, ({ many }) => ({
  generations: many(generations),
}));

export const generationsRelations = relations(generations, ({ one }) => ({
  user: one(users, { fields: [generations.userId], references: [users.id] }),
}));

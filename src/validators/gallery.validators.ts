import { z } from 'zod';

export const galleryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).optional().default(1),
});

export const galleryIdSchema = z.object({ id: z.uuid({ error: 'Invalid visualization id.' }) });

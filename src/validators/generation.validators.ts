import { z } from 'zod';

export const createGenerationSchema = z.object({
  textureId: z.uuid({ error: 'Please choose a sample first.' }),
  prompt: z
    .string()
    .trim()
    .max(500, { error: 'The style description must be 500 characters or fewer.' })
    .optional()
    .default(''),
});

export const generationIdSchema = z.object({ id: z.uuid({ error: 'Invalid visualization id.' }) });

export const imageIdSchema = z.object({
  id: z.uuid({ error: 'Invalid visualization id.' }),
  imageId: z.uuid({ error: 'Invalid picture id.' }),
});

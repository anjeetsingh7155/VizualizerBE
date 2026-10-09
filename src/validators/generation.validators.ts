import { z } from 'zod';
import { spaceTypeEnum } from '../db/schema';

export const createGenerationSchema = z.object({
  textureId: z.uuid({ error: 'Please choose a sample first.' }),
  prompt: z
    .string()
    .trim()
    .max(500, { error: 'The style description must be 500 characters or fewer.' })
    .optional()
    .default(''),
  // Which spaces to create (1 to 6). Leave out to create all six.
  spaces: z
    .array(z.enum(spaceTypeEnum.enumValues, { error: 'Unknown space.' }))
    .min(1, { error: 'Choose at least one space.' })
    .max(6)
    .optional(),
});

export const generationIdSchema = z.object({ id: z.uuid({ error: 'Invalid visualization id.' }) });


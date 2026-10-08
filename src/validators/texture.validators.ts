import { z } from 'zod';
import { priceUnitEnum, textureCategoryEnum } from '../db/schema';

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, { error: `${label} must be ${max} characters or fewer.` })
    .optional()
    .transform((v) => (v ? v : null));

// Form fields arrive as text (multipart/form-data), so numbers are converted here.
const optionalPrice = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v, ctx) => {
    if (v === undefined || v === '') return null;
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n) || n < 0 || n > 10_000_000) {
      ctx.addIssue({ code: 'custom', message: 'Enter a valid price (0 – 1,00,00,000).' });
      return z.NEVER;
    }
    return n.toFixed(2);
  });

const textureFields = {
  name: z
    .string({ error: 'Name is required.' })
    .trim()
    .min(1, { error: 'Name is required.' })
    .max(120, { error: 'Name must be 120 characters or fewer.' }),
  category: z.enum(textureCategoryEnum.enumValues, { error: 'Choose a category.' }),
  size: optionalText(60, 'Size'),
  finish: optionalText(40, 'Finish'),
  priceAmount: optionalPrice,
  priceUnit: z.enum(priceUnitEnum.enumValues, { error: 'Choose a price unit.' }),
};

export const createTextureSchema = z.object({
  ...textureFields,
  priceUnit: textureFields.priceUnit.default('sq_ft'),
});

/**
 * For editing: every field is optional and has NO default, so only the fields
 * actually sent are changed (e.g. changing only the price keeps the price unit).
 */
export const updateTextureSchema = z.object(textureFields).partial();

export const listTexturesQuerySchema = z.object({
  category: z.enum(textureCategoryEnum.enumValues).optional(),
});

export const textureIdSchema = z.object({ id: z.uuid({ error: 'Invalid sample id.' }) });

export type CreateTextureInput = z.infer<typeof createTextureSchema>;
export type UpdateTextureInput = z.infer<typeof updateTextureSchema>;

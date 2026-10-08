import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  DATABASE_URL: z
    .string()
    .min(1, 'is required')
    .refine((v) => v.startsWith('postgres://') || v.startsWith('postgresql://'), {
      message: 'must start with postgresql://',
    }),
  JWT_SECRET: z.string().min(32, 'must be at least 32 characters long'),
  JWT_EXPIRES_IN: z
    .string()
    .regex(/^\d+[smhd]$/, 'must look like 15m, 12h or 7d')
    .default('7d'),
  // Where uploaded and generated images are kept ("local" = a folder on this computer).
  STORAGE_DRIVER: z.enum(['local']).default('local'),
  UPLOAD_DIR: z.string().min(1).default('uploads'),
  // Largest image accepted per file, in megabytes.
  MAX_UPLOAD_MB: z.coerce.number().positive().max(50).default(10),
  // fal.ai API key (from fal.ai → Dashboard → API Keys). Empty = image generation is switched off.
  FAL_KEY: z.string().trim().default(''),
  // The fal.ai image model used. Works with the Nano Banana family, e.g.
  // fal-ai/nano-banana/edit (default), fal-ai/nano-banana-2/edit, fal-ai/nano-banana-pro/edit.
  FAL_MODEL: z.string().trim().min(1).default('fal-ai/nano-banana/edit'),
  // fal.ai's queue address. Only changed for testing.
  FAL_QUEUE_URL: z.url().default('https://queue.fal.run'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration (check server/.env):');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;

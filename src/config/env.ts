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

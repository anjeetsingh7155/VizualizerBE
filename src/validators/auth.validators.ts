import { z } from 'zod';

const email = z
  .string({ error: 'Email is required.' })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Enter a valid email address.' }).max(255));

export const registerSchema = z
  .object({
    name: z
      .string({ error: 'Full name is required.' })
      .trim()
      .min(1, { error: 'Full name is required.' })
      .max(100, { error: 'Name must be 100 characters or fewer.' }),
    email,
    password: z
      .string({ error: 'Password is required.' })
      .min(8, { error: 'Password must be at least 8 characters.' })
      .max(72, { error: 'Password must be 72 characters or fewer.' }),
    confirmPassword: z.string({ error: 'Please confirm your password.' }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ['confirmPassword'],
    error: 'Passwords do not match.',
  });

export const loginSchema = z.object({
  email,
  password: z.string({ error: 'Password is required.' }).min(1, { error: 'Password is required.' }),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

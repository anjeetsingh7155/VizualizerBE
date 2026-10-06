import type { Request, Response } from 'express';
import { loginSchema, registerSchema } from '../validators/auth.validators';
import { getUserById, loginUser, registerUser } from '../services/auth.service';
import { sendSuccess } from '../utils/response';
import { UnauthorizedError } from '../utils/errors';

export async function register(req: Request, res: Response) {
  const input = registerSchema.parse(req.body ?? {});
  const result = await registerUser(input);
  return sendSuccess(res, 201, 'Account created successfully', result);
}

export async function login(req: Request, res: Response) {
  const input = loginSchema.parse(req.body ?? {});
  const result = await loginUser(input);
  return sendSuccess(res, 200, 'Signed in successfully', result);
}

export async function me(req: Request, res: Response) {
  if (!req.userId) throw new UnauthorizedError();
  const user = await getUserById(req.userId);
  return sendSuccess(res, 200, 'Current user', { user });
}

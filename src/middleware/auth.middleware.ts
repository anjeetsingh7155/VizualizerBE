import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { UnauthorizedError } from '../utils/errors';

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : null;

  if (!token) {
    return next(new UnauthorizedError());
  }

  const userId = verifyAccessToken(token);
  if (!userId) {
    return next(new UnauthorizedError('Your session has expired. Please sign in again.', 'TOKEN_INVALID'));
  }

  req.userId = userId;
  next();
}

/**
 * For pages anyone can see (the gallery): if a valid sign-in is sent, remember who it is
 * (to show which items they saved); otherwise continue as a guest. Never blocks the request.
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : null;
  const userId = token ? verifyAccessToken(token) : null;
  if (userId) req.userId = userId;
  next();
}

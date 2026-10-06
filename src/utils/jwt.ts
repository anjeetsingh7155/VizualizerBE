import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';

interface TokenPayload {
  sub: string;
}

export function signAccessToken(userId: string): string {
  const options: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as NonNullable<SignOptions['expiresIn']>,
    algorithm: 'HS256',
  };
  return jwt.sign({ sub: userId } satisfies TokenPayload, env.JWT_SECRET, options);
}

/** Returns the user id inside a valid token, or null if the token is invalid or expired. */
export function verifyAccessToken(token: string): string | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    if (typeof decoded === 'object' && typeof decoded.sub === 'string') return decoded.sub;
    return null;
  } catch {
    return null;
  }
}

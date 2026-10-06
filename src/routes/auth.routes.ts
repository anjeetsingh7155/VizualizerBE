import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { login, me, register } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { env } from '../config/env';

// Slows down password guessing: 10 attempts per 15 minutes per IP address in production
// (relaxed to 100 during development so testing is not blocked).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.NODE_ENV === 'production' ? 10 : 100,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many attempts. Please wait a few minutes and try again.',
    error: { code: 'RATE_LIMITED' },
  },
});

export const authRouter = Router();

authRouter.post('/register', authLimiter, register);
authRouter.post('/login', authLimiter, login);
authRouter.get('/me', requireAuth, me);

import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { MulterError } from 'multer';
import { AppError } from '../utils/errors';
import { env } from '../config/env';

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ success: false, message: 'Route not found', error: { code: 'NOT_FOUND' } });
}

function isBodyParseError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { type?: string }).type === 'entity.parse.failed';
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) {
      const key = issue.path.join('.') || 'body';
      fields[key] ??= issue.message;
    }
    return res.status(400).json({
      success: false,
      message: 'Please check the highlighted fields.',
      error: { code: 'VALIDATION_ERROR', fields },
    });
  }

  if (err instanceof MulterError) {
    const tooLarge = err.code === 'LIMIT_FILE_SIZE';
    return res.status(tooLarge ? 413 : 400).json({
      success: false,
      message: tooLarge
        ? `Each image must be ${env.MAX_UPLOAD_MB} MB or smaller.`
        : err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT'
          ? 'Unexpected file in the upload. Please send only the texture and room images.'
          : 'The upload could not be processed. Please try again.',
      error: { code: tooLarge ? 'FILE_TOO_LARGE' : 'UPLOAD_ERROR' },
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      error: { code: err.code, ...(err.details ? { fields: err.details } : {}) },
    });
  }

  if (isBodyParseError(err)) {
    return res.status(400).json({ success: false, message: 'Invalid request body.', error: { code: 'BAD_REQUEST' } });
  }

  // Unexpected error: log details on the server only, never send them to the app.
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[error] ${req.method} ${req.originalUrl}: ${message}`);
  if (env.NODE_ENV !== 'production' && err instanceof Error && err.stack) {
    console.error(err.stack);
  }

  return res.status(500).json({
    success: false,
    message: 'Something went wrong. Please try again.',
    error: { code: 'INTERNAL_ERROR' },
  });
}

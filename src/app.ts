import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { authRouter } from './routes/auth.routes';
import { uploadRoot } from './services/storage';
import { LOCAL_PUBLIC_PREFIX } from './services/storage/local.storage';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  // Allow the app to display images served by this server.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/v1/health', (_req, res) => {
    res.json({ success: true, message: 'API is healthy' });
  });

  app.use('/api/v1/auth', authRouter);

  // Serves locally stored images (development storage) at /uploads/...
  app.use(
    LOCAL_PUBLIC_PREFIX,
    express.static(uploadRoot, { index: false, dotfiles: 'deny', maxAge: '7d', immutable: true }),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

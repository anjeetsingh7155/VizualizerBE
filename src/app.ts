import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { authRouter } from './routes/auth.routes';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/v1/health', (_req, res) => {
    res.json({ success: true, message: 'API is healthy' });
  });

  app.use('/api/v1/auth', authRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

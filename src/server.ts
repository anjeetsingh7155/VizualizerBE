import { env } from './config/env';
import { checkDatabaseConnection } from './config/database';
import { createApp } from './app';

async function start() {
  try {
    await checkDatabaseConnection();
    console.log('Connected to PostgreSQL');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Could not connect to PostgreSQL: ${message}`);
    console.error('Check DATABASE_URL in server/.env and that PostgreSQL is running.');
    process.exit(1);
  }

  createApp().listen(env.PORT, () => {
    console.log(`Vizualizer API running on http://localhost:${env.PORT}`);
  });
}

void start();

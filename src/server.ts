import { env } from './config/env';
import { checkDatabaseConnection } from './config/database';
import { createApp } from './app';
import { markInterruptedGenerations } from './services/generation.service';
import { isAiConfigured } from './services/ai/fal.client';

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

  await markInterruptedGenerations().catch((error: unknown) => {
    console.error('Could not tidy up unfinished visualizations:', error);
  });

  createApp().listen(env.PORT, () => {
    console.log(`Vizualizer API running on http://localhost:${env.PORT}`);
    console.log(
      isAiConfigured()
        ? `AI image generation: on (fal.ai model ${env.FAL_MODEL})`
        : 'AI image generation: OFF — add FAL_KEY to server/.env and restart to switch it on',
    );
  });
}

void start();

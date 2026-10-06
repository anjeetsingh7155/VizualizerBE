import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { env } from './env';
import * as schema from '../db/schema';

export const pool = new Pool({ connectionString: env.DATABASE_URL, max: 10 });

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL error:', error.message);
});

export const db = drizzle(pool, { schema });

export async function checkDatabaseConnection(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
  } finally {
    client.release();
  }
}

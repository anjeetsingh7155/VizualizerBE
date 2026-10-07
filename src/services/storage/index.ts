import path from 'node:path';
import { env } from '../../config/env';
import { LocalStorageProvider } from './local.storage';
import type { StorageProvider } from './storage.types';

export const uploadRoot = path.resolve(env.UPLOAD_DIR);

/**
 * The storage used by the app. To move to S3 / R2 / Supabase / Cloudinary later,
 * add a provider class and choose it here; nothing else in the app needs to change.
 */
function createStorage(): StorageProvider {
  switch (env.STORAGE_DRIVER) {
    case 'local':
      return new LocalStorageProvider(uploadRoot);
  }
}

export const storage = createStorage();
export type { StorageProvider, StoredFile, SaveFileInput } from './storage.types';

import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { SaveFileInput, StorageProvider, StoredFile } from './storage.types';

export const LOCAL_PUBLIC_PREFIX = '/uploads';

/** Development storage: saves files in a folder on this computer. */
export class LocalStorageProvider implements StorageProvider {
  constructor(private readonly rootDir: string) {}

  async save({ buffer, extension, folder }: SaveFileInput): Promise<StoredFile> {
    const safeFolder = folder.replace(/[^a-z0-9-]/gi, '');
    const safeExt = extension.replace(/[^a-z0-9]/gi, '').toLowerCase();
    const key = `${safeFolder}/${randomUUID()}.${safeExt}`;

    const filePath = this.resolve(key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, buffer, { flag: 'wx' });

    return { key, url: `${LOCAL_PUBLIC_PREFIX}/${key}` };
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(this.resolve(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }

  /** Converts a key to a file path, refusing anything outside the upload folder. */
  private resolve(key: string): string {
    const filePath = path.resolve(this.rootDir, key);
    if (!filePath.startsWith(path.resolve(this.rootDir) + path.sep)) {
      throw new Error('Invalid storage key');
    }
    return filePath;
  }
}

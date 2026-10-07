export interface SaveFileInput {
  buffer: Buffer;
  /** File extension without the dot, e.g. "jpg". */
  extension: string;
  contentType: string;
  /** Sub-folder such as "textures", "rooms" or "generated". */
  folder: string;
}

export interface StoredFile {
  /** Storage key used to delete the file later, e.g. "rooms/3f2b….jpg". */
  key: string;
  /**
   * Link saved in the database. Local storage returns a path like "/uploads/rooms/3f2b….jpg"
   * (turned into a full link per request); cloud storage would return a full https link.
   */
  url: string;
}

/** Any storage (local folder, S3, R2, Supabase, Cloudinary) must provide these two operations. */
export interface StorageProvider {
  save(input: SaveFileInput): Promise<StoredFile>;
  delete(key: string): Promise<void>;
}

import type { Request } from 'express';

/**
 * Stored links may be paths like "/uploads/rooms/x.jpg" (local storage).
 * This turns them into a full link the phone can open, using the address the phone used
 * to reach the server (e.g. http://192.168.1.20:5000/uploads/rooms/x.jpg).
 */
export function toAbsoluteUrl(req: Request, url: string | null): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${req.protocol}://${req.get('host')}${url}`;
}

import { Router } from 'express';
import { optionalAuth, requireAuth } from '../middleware/auth.middleware';
import { gallery, galleryItem, save, saved, unsave } from '../controllers/gallery.controller';

/** /api/v1/gallery — the public gallery for the mobile app (no sign-in needed to look). */
export const galleryRouter = Router();
galleryRouter.get('/', optionalAuth, gallery);
galleryRouter.get('/:id', optionalAuth, galleryItem);

/** /api/v1/bookmarks — items a signed-in person saved. */
export const bookmarkRouter = Router();
bookmarkRouter.use(requireAuth);
bookmarkRouter.get('/', saved);
bookmarkRouter.put('/:id', save);
bookmarkRouter.delete('/:id', unsave);

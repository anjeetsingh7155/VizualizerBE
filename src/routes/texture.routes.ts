import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { textureImagesUpload } from '../middleware/upload.middleware';
import {
  createTextureHandler,
  deleteTextureHandler,
  getTextureById,
  listTexturesHandler,
  updateTextureHandler,
} from '../controllers/texture.controller';

/**
 * /api/v1/textures — the sample library.
 * Any signed-in user can view, add, edit and delete samples.
 */
export const textureRouter = Router();
textureRouter.use(requireAuth);
textureRouter.get('/', listTexturesHandler);
textureRouter.get('/:id', getTextureById);
textureRouter.post('/', textureImagesUpload, createTextureHandler);
textureRouter.patch('/:id', textureImagesUpload, updateTextureHandler);
textureRouter.delete('/:id', deleteTextureHandler);

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { create, getOne, list, remove, retry } from '../controllers/generation.controller';

/**
 * /api/v1/generations — create six AI pictures of a sample and see them later (History).
 * Every route needs a signed-in user. Everyone can see all visualizations;
 * only the creator can retry its pictures or delete it.
 */
export const generationRouter = Router();
generationRouter.use(requireAuth);
generationRouter.post('/', create);
generationRouter.get('/', list);
generationRouter.get('/:id', getOne);
generationRouter.post('/:id/retry', retry);
generationRouter.delete('/:id', remove);

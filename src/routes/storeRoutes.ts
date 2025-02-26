// src/routes/storeRoutes.ts
import { Router } from 'express';
import { StoreController } from '../controllers/storeController';
import { authenticateUser } from '../middleware/authMiddleware';

const router = Router();
const controller = new StoreController();

// Public routes
router.post('/', controller.create);
router.post('/login', controller.login);
router.get('/', controller.getAll);
router.get('/nearby', controller.getNearbyStores);
router.get('/:id', controller.getById);

// Protected routes
router.put('/:id', authenticateUser, controller.update);
router.delete('/:id', authenticateUser, controller.delete);

export default router;
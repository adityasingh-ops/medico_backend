import { Router } from 'express';
import { CartController } from '../controllers/cartController';
import { authenticateUser } from '../middleware/authMiddleware';

const router = Router();

// Cart routes
router.get('/', authenticateUser, CartController.getCart);
router.post('/add', authenticateUser, CartController.addItem);
router.put('/update', authenticateUser, CartController.updateItemQuantity);
router.delete('/remove', authenticateUser, CartController.removeItem);
router.delete('/clear', authenticateUser, CartController.clearCart);

export default router;
import { Router } from 'express';
import { StoreController } from '../controllers/storeController';

const router = Router();
const controller = new StoreController();

router.post('/', controller.create);
router.get('/', controller.getAll);
router.get('/nearby', controller.getNearbyStores);
router.get('/:id', controller.getById);
router.put('/:id', controller.update);
router.delete('/:id', controller.delete);

export default router;

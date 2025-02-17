import { Router } from 'express';
import { MedicineController } from '../controllers/medicineController';

const router = Router();
const controller = new MedicineController();

router.post('/', controller.create);
router.post('/bulk', controller.bulkCreate);
router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.put('/:id', controller.update);
router.delete('/:id', controller.delete);

router.get('/category/:categoryId', controller.getMedicineByCategory);

export default router;
import { Router } from 'express';
import { PrescriptionController } from '../controllers/prescriptionController';
import { authenticateUser } from '../middleware/authMiddleware';

const router = Router();

router.post('/extract', authenticateUser, PrescriptionController.extract);

export default router;

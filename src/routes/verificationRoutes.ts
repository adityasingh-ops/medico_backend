import { Router } from 'express';
import { VerificationController } from '../controllers/verificationController';
import { authenticateUser } from '../middleware/authMiddleware';

const router = Router();

router.post('/', authenticateUser, VerificationController.create);
router.get('/:id', authenticateUser, VerificationController.get);

// Doctor-side decision endpoint (secure for doctors in production).
router.put('/:id/decision', VerificationController.decide);

// Dev-only: simulate doctor approval so the flow is demoable without a doctor app.
router.post('/:id/simulate', authenticateUser, VerificationController.simulate);

export default router;

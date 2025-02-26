import express from 'express';
import { StoreMessageController } from '../controllers/storeMessageController';
import { authenticateUser } from '../middleware/authMiddleware';

const router = express.Router();
const storeMessageController = new StoreMessageController();

// Authenticate all routes
router.use(authenticateUser);

// Preset messages management
router.get('/preset-messages', storeMessageController.getStorePresetMessages);
router.post('/preset-messages', storeMessageController.createPresetMessage);
router.put('/preset-messages/:id', storeMessageController.updatePresetMessage);
router.delete('/preset-messages/:id', storeMessageController.deletePresetMessage);

// Message handling
router.post('/rooms/:roomId/product-suggestion', storeMessageController.sendProductSuggestion);
router.post('/rooms/:roomId/prescription-clarification', storeMessageController.handlePrescriptionClarification);

export default router;
import express from 'express';
import { ChatController } from '../controllers/chatController';
import { authenticateUser } from '../middleware/authMiddleware';

const router = express.Router();
const chatController = new ChatController();

// Public routes (none for chat)

// Protected routes (require authentication)
router.use(authenticateUser);

// Store discovery for chat
router.post('/nearby-stores', chatController.getNearbyStores);

// Chat room operations
router.get('/rooms', chatController.getActiveChatRooms);
router.post('/rooms', chatController.createOrGetChatRoom);
router.get('/rooms/:roomId/messages', chatController.getChatHistory);
router.post('/rooms/:roomId/read', chatController.markMessagesAsRead);

// Prescription upload in chat
router.post('/rooms/:roomId/prescription', chatController.handlePrescriptionUpload);

// Preset messages
router.get('/preset-messages/:storeId', chatController.getPresetMessages);
router.post('/rooms/:roomId/preset-message', chatController.sendPresetMessage);

export default router;
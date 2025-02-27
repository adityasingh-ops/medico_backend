// src/routes/userRoutes.ts
import express from 'express';
import {
  sendOTP,
  verifyOTP,
  updateProfile
} from '../controllers/userController';
import { authenticateUser } from '../middleware/authMiddleware';

const router = express.Router();

// Public routes
router.post('/send-otp', sendOTP);
router.post('/verify-otp', verifyOTP);

// Protected routes
router.put('/profile', authenticateUser, updateProfile);

export default router;
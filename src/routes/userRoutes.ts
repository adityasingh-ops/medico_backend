// src/routes/userRoutes.ts
import express from 'express';
import {
  sendOTP,
  verifyOTP,
  updateProfile,
  loginStore
} from '../controllers/userController';
import { authenticateUser } from '../middleware/authMiddleware'; // Change the import path from middleware/authMiddleware to middleware/auth

const router = express.Router();

// Public routes
router.post('/send-otp', sendOTP);
router.post('/verify-otp', verifyOTP);
router.post('/login-store', loginStore);

// Protected routes
router.put('/profile', authenticateUser, updateProfile);

export default router;
// src/routes/userRoutes.ts
import express from 'express';
import {
  sendOTP,
  verifyOTP,
  updateProfile,
  loginStore
} from '../controllers/userController';
// import { protect, userOnly } from '../middleware/auth';

const router = express.Router();

// Public routes
router.post('/send-otp', sendOTP);
router.post('/verify-otp', verifyOTP);
router.post('/login-store', loginStore);

// // Protected routes
// router.use(protect);
// router.use(userOnly);
router.put('/profile', updateProfile);

export default router;
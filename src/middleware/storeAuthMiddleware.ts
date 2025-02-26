import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Store } from '../models/Store'; // Fixed import
import bcrypt from 'bcryptjs';

// Extend Express Request type to include store
declare global {
  namespace Express {
    interface Request {
      store?: any;
    }
  }
}

export const validateStore = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Not authorized to access this route'
      });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string; type: string; storeId?: string };

    if (decoded.type !== 'store') {
      res.status(401).json({
        success: false,
        error: 'Not authorized as store'
      });
      return;
    }

    // First, try finding the store by the ID in the token
    let store = await Store.findById(decoded.id);
    
    // If not found and there's a storeId in the token, try that
    if (!store && decoded.storeId) {
      store = await Store.findById(decoded.storeId);
    }
    
    if (!store || !store.isActive) {
      res.status(401).json({
        success: false,
        error: 'Store not found or inactive'
      });
      return;
    }

    req.store = store;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Not authorized to access this route'
    });
  }
};

// Store login function - moved from storeAuthController.ts
export const loginStore = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Validate request body
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Find store by email
    const store = await Store.findOne({ email });
    if (!store) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if store is active
    if (!store.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Store account is inactive'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, store.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate JWT token with both userId and storeId
    const token = jwt.sign(
      { 
        id: store._id, 
        type: 'store',
        storeId: store._id  // Include explicit storeId
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '30d' }
    );

    // Return store data and token
    res.json({
      success: true,
      data: {
        _id: store._id,
        name: store.name,
        email: store.email,
        phone: store.phone,
        address: store.address,
        isVerified: store.isVerified,
        isActive: store.isActive,
        storeType: store.storeType,
        token
      }
    });
  } catch (error) {
    console.error('Store Login Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error logging in'
    });
  }
};
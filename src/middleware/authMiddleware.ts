// src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { Store } from '../models/Store';

// Extend Express Request type to include user
declare global {
    namespace Express {
        interface Request {
            user?: any;
        }
    }
}

interface TokenPayload {
    id: string;
    role?: string;
    type?: string;
    storeId?: string;
}

// Authentication middleware
export const authenticateUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Get token from header
        const authHeader = req.header('Authorization');
        const token = authHeader?.startsWith('Bearer ') 
            ? authHeader.substring(7) 
            : authHeader;

        if (!token) {
            return res.status(401).json({ message: 'No authentication token provided' });
        }

        // Verify token
        const decoded = jwt.verify(
            token, 
            process.env.JWT_SECRET || 'your-secret-key'
        ) as TokenPayload;

        // Find user
        let user = await User.findById(decoded.id).select('-__v');
        
        // If user not found but it's a store token, try to find the store
        if (!user && (decoded.type === 'store' || decoded.storeId)) {
            const storeId = decoded.storeId || decoded.id;
            const store = await Store.findById(storeId);
            
            if (store) {
                // Create a plain object instead of trying to create a Document instance
                // This is fine since we just need req.user to have the necessary properties
                // TypeScript is complaining because we're trying to assign a plain object to a Mongoose Document type
                const storeObj = store.toObject ? store.toObject() : JSON.parse(JSON.stringify(store));
                req.user = {
                    _id: storeObj._id,
                    name: storeObj.name,
                    email: storeObj.email,
                    phone: storeObj.phone,
                    userType: 'store',
                    storeId: storeObj._id
                };
                next();
                return;
            }
        }
        
        if (!user) {
            return res.status(401).json({ message: 'User not found' });
        }

        // Attach user to request
        req.user = user;
        next();
    } catch (error) {
        console.error('Auth error:', error);
        if (error instanceof jwt.JsonWebTokenError) {
            return res.status(401).json({ message: 'Invalid token' });
        }
        if (error instanceof jwt.TokenExpiredError) {
            return res.status(401).json({ message: 'Token expired' });
        }
        return res.status(401).json({ message: 'Authentication error' });
    }
};

// Optional: Phone verification middleware
export const requirePhoneVerification = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user.isPhoneVerified) {
        return res.status(403).json({ 
            message: 'Phone number must be verified to access this resource' 
        });
    }
    next();
};

// Optional: Admin authorization middleware
export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ 
            message: 'Admin access required' 
        });
    }
    next();
};

// Example usage in routes:
/*
import { Router } from 'express';
import { authenticateUser, requirePhoneVerification, requireAdmin } from '../middleware/auth';

const router = Router();

// Public route
router.post('/send-otp', sendOTP);
router.post('/verify-otp', verifyOTP);

// Protected route (requires authentication)
router.get('/profile', authenticateUser, getProfile);

// Protected route (requires phone verification)
router.put('/profile', 
    authenticateUser, 
    requirePhoneVerification, 
    updateProfile
);

// Admin route
router.get('/users', 
    authenticateUser, 
    requireAdmin, 
    getAllUsers
);

export default router;
*/
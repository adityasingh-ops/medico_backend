// src/controllers/storeAuthController.ts
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Store } from '../models/Store';

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

        // Generate JWT token
        const token = jwt.sign(
            { 
                id: store._id, 
                type: 'store'
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
// src/controllers/userController.ts
import { Request, Response } from 'express';
import axios from 'axios';
import User from '../models/User';
import generateToken from '../utils/generateToken';
import { Store } from '../models/Store';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const sendOTP = async (req: Request, res: Response) => {
    try {
        const { phone } = req.body;

        if (!phone) {
            return res.status(400).json({ message: 'Phone number is required' });
        }

        // Generate a random 6-digit OTP for development
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        console.log(`Development OTP for ${phone}: ${otp}`);

        /* Commented out 2Factor API call for development
        const response = await axios.get(
            `https://2factor.in/API/V1/${process.env.TWO_FACTOR_API_KEY}/SMS/${phone}/AUTOGEN`
        );

        if (response.data.Status === 'Success') {
            res.json({
                message: 'OTP sent successfully',
                session_id: response.data.Details
            });
        } else {
            throw new Error('Failed to send OTP');
        }
        */

        // Development response
        res.json({
            message: 'OTP sent successfully',
            session_id: `DEV_${Date.now()}`,
            // Remove this in production
            otp: otp
        });
    } catch (error) {
        console.error('Send OTP Error:', error);
        res.status(500).json({ message: 'Error sending OTP' });
    }
};

export const verifyOTP = async (req: Request, res: Response) => {
    try {
        const { phone, otp, session_id } = req.body;

        if (!phone || !otp || !session_id) {
            return res.status(400).json({
                message: 'Phone number, OTP, and session ID are required'
            });
        }

        /* Commented out 2Factor verification for development
        const response = await axios.get(
            `https://2factor.in/API/V1/${process.env.TWO_FACTOR_API_KEY}/SMS/VERIFY/${session_id}/${otp}`
        );

        if (response.data.Status === 'Success') {
        */

        // Development verification - log the verification attempt
        console.log(`Verifying OTP for phone: ${phone}, OTP: ${otp}, Session: ${session_id}`);
        
        // For development, always consider OTP as valid
        if (otp.length === 6) {  // Basic validation for development
            // Check if user exists
            let user = await User.findOne({ phone });

            if (!user) {
                // Create new user with only phone number
                user = await User.create({
                    phone,
                    email: `user${phone}@example.com`, // Added default email to prevent null email error
                    isPhoneVerified: true,
                    // Don't set location if coordinates aren't available
                });
            } else {
                // Update phone verification status
                user.isPhoneVerified = true;
                await user.save();
            }

            res.json({
                _id: user._id,
                phone: user.phone,
                isPhoneVerified: user.isPhoneVerified,
                token: generateToken(user._id.toString(), 'user')
            });
        } else {
            res.status(400).json({ message: 'Invalid OTP' });
        }
    } catch (error) {
        console.error('Verify OTP Error:', error);
        res.status(500).json({
            message: error instanceof Error ? error.message : 'Error verifying OTP'
        });
    }
};

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
        const storeUser = await User.findOne({ email });
        if (!storeUser) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Find store ID from Store collection
        const store = await Store.findOne({ email }).select('_id');
        const storeId = store?._id || null;

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, storeUser.password!);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            { 
                id: storeUser._id, 
                type: 'store',
                storeId: storeId // Include storeId in token
            },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '30d' }
        );

        // Return store data and token
        res.json({
            success: true,
            data: {
                _id: storeUser._id,
                storeId: storeId,
                name: storeUser.name,
                email: storeUser.email,
                phone: storeUser.phone,
                address: storeUser.address,
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

// Update user profile after phone verification
export const updateProfile = async (req: Request, res: Response) => {
    try {
        const { name, email, location } = req.body;
        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Only update provided fields
        if (name) user.name = name;
        if (email) user.email = email;
        if (location && location.coordinates) {
            user.location = {
                type: 'Point',
                coordinates: location.coordinates
            };
        }

        const updatedUser = await user.save();

        res.json({
            _id: updatedUser._id,
            phone: updatedUser.phone,
            name: updatedUser.name,
            email: updatedUser.email,
            location: updatedUser.location,
            isPhoneVerified: updatedUser.isPhoneVerified
        });
    } catch (error) {
        console.error('Update Profile Error:', error);
        res.status(500).json({
            message: error instanceof Error ? error.message : 'Error updating profile'
        });
    }
};
import { Request, Response } from 'express';
import { Store } from '../models/Store';
import User from '../models/User';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export class StoreController {
  async create(req: Request, res: Response): Promise<void> {
    try {
      // Validate required fields
      const requiredFields = [
        'name',
        'email',
        'password',
        'phone',
        'address',
        'gstNumber',
        'licenseNumber',
        'pharmacistName',
        'pharmacistLicense',
        'deliveryZone'
      ];

      const missingFields = requiredFields.filter(field => !req.body[field]);

      if (missingFields.length > 0) {
        res.status(400).json({
          success: false,
          error: `Missing required fields: ${missingFields.join(', ')}`
        });
        return;
      }

      // Validate address fields
      const requiredAddressFields = ['street', 'city', 'state', 'pincode'];
      const missingAddressFields = requiredAddressFields.filter(
        field => !req.body.address[field]
      );

      if (missingAddressFields.length > 0) {
        res.status(400).json({
          success: false,
          error: `Missing required address fields: ${missingAddressFields.join(', ')}`
        });
        return;
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(req.body.password, salt);

      // Create store with hashed password
      const storeData = {
        ...req.body,
        password: hashedPassword,
        storeType: ['RETAIL'], // Set store type as medical
        location: {
          type: 'Point',
          coordinates: req.body.location?.coordinates || [0, 0] // Default coordinates if not provided
        }
      };

      const store = await Store.create(storeData);

      // Create corresponding user account for store owner
      const userData = {
        name: req.body.name,
        email: req.body.email,
        password: hashedPassword,
        phone: req.body.phone,
        userType: 'store',
        address: [{
          street: req.body.address.street,
          city: req.body.address.city,
          state: req.body.address.state,
          pincode: req.body.address.pincode,
          isDefault: true
        }],
        isPhoneVerified: false, // Will be verified through OTP
        location: store.location
      };

      const user = await User.create(userData);

      // Generate JWT token
      const token = jwt.sign(
        { id: store._id, type: 'store' },
        process.env.JWT_SECRET!,
        { expiresIn: '30d' }
      );

      res.status(201).json({
        success: true,
        data: {
          store: {
            _id: store._id,
            name: store.name,
            email: store.email,
            phone: store.phone,
            address: store.address,
            isVerified: store.isVerified
          },
          user: {
            _id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            userType: user.userType
          },
          token
        }
      });

    } catch (error: any) {
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        res.status(400).json({
          success: false,
          error: `Store with this ${field} already exists`
        });
        return;
      }

      if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map((err: any) => err.message);
        res.status(400).json({
          success: false,
          error: messages
        });
        return;
      }

      console.error('Store creation error:', error);
      res.status(500).json({
        success: false,
        error: 'Server Error'
      });
    }
  }

  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const stores = await Store.find();

      res.status(200).json({
        success: true,
        data: stores
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Server Error'
      });
    }
  }

  async getNearbyStores(req: Request, res: Response): Promise<void> {
    try {
      const { longitude, latitude, maxDistance = 5000 } = req.query; // maxDistance in meters

      const stores = await Store.find({
        location: { 
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [Number(longitude), Number(latitude)]
            },
            $maxDistance: Number(maxDistance)
          }
        }
      });

      res.status(200).json({
        success: true,
        data: stores
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Server Error'
      });
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const store = await Store.findById(req.params.id);

      if (!store) {
        res.status(404).json({
          success: false,
          error: 'Store not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: store
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Server Error'
      });
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const store = await Store.findByIdAndUpdate(
        req.params.id,
        { ...req.body, updatedAt: new Date() },
        { new: true, runValidators: true }
      );

      if (!store) {
        res.status(404).json({
          success: false,
          error: 'Store not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: store
      });
    } catch (error: any) {
      if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map((err: any) => err.message);
        res.status(400).json({
          success: false,
          error: messages
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Server Error'
      });
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const store = await Store.findByIdAndDelete(req.params.id);

      if (!store) {
        res.status(404).json({
          success: false,
          error: 'Store not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {}
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Server Error'
      });
    }
  }
}
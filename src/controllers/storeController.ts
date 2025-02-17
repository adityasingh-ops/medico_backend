import { Request, Response } from 'express';
import { Store } from '../models/Store';

export class StoreController {
  async create(req: Request, res: Response): Promise<void> {
    try {
      const store = await Store.create(req.body);
      
      res.status(201).json({
        success: true,
        data: store
      });
    } catch (error: any) {
      if (error.code === 11000) {
        res.status(400).json({
          success: false,
          error: 'Store with this email already exists'
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
import { Request, Response } from 'express';
import { Category } from '../models/Category';

export class CategoryController {
  // Get all categories
  public async getAllCategories(req: Request, res: Response): Promise<void> {
    try {
      const categories = await Category.find().sort({ createdAt: -1 });
      res.status(200).json({
        success: true,
        data: categories
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Server Error'
      });
    }
  }

  // Get single category
  public async getCategory(req: Request, res: Response): Promise<void> {
    try {
      const category = await Category.findOne({ id: req.params.id });
      
      if (!category) {
        res.status(404).json({
          success: false,
          error: 'Category not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: category
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Server Error'
      });
    }
  }

  // Create new category
  public async createCategory(req: Request, res: Response): Promise<void> {
    try {
      const category = await Category.create(req.body);
      
      res.status(201).json({
        success: true,
        data: category
      });
    } catch (error:any) {
      if (error.code === 11000) { // Duplicate key error
        res.status(400).json({
          success: false,
          error: 'Category ID already exists'
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        error: 'Server Error'
      });
    }
  }

  // Update category
  public async updateCategory(req: Request, res: Response): Promise<void> {
    try {
      const category = await Category.findOneAndUpdate(
        { id: req.params.id },
        { ...req.body, updatedAt: Date.now() },
        { new: true, runValidators: true }
      );

      if (!category) {
        res.status(404).json({
          success: false,
          error: 'Category not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: category
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Server Error'
      });
    }
  }

  // Delete category
  public async deleteCategory(req: Request, res: Response): Promise<void> {
    try {
      const category = await Category.findOneAndDelete({ id: req.params.id });

      if (!category) {
        res.status(404).json({
          success: false,
          error: 'Category not found'
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

  // Seed categories
  public async seedCategories(req: Request, res: Response): Promise<void> {
    try {
      // First, clear existing categories
      await Category.deleteMany({});

      // Import your categories array
      const { categories } = require('../data/categories');
      
      // Insert all categories
      await Category.insertMany(categories);

      res.status(201).json({
        success: true,
        message: 'Categories seeded successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Server Error'
      });
    }
  }
}

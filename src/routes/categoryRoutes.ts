// src/routes/categoryRoutes.ts
import { Router } from 'express';
import { CategoryController } from '../controllers/categotyController';

const router = Router();
const categoryController = new CategoryController();

// Define routes
router
  .route('/')
  .get(categoryController.getAllCategories)
  .post(categoryController.createCategory);

router
  .route('/:id')
  .get(categoryController.getCategory)
  .put(categoryController.updateCategory)
  .delete(categoryController.deleteCategory);

// Seed route - be careful with this in production
router.post('/seed', categoryController.seedCategories);

export default router;
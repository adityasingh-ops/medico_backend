import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import {Store} from '../models/Store';

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

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string; type: string };

    if (decoded.type !== 'store') {
      res.status(401).json({
        success: false,
        error: 'Not authorized as store'
      });
      return;
    }

    const store = await Store.findById(decoded.id);
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

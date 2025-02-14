// src/server.ts
import dotenv from 'dotenv';
dotenv.config(); // This needs to be at the top

import express, { Express, Request, Response, NextFunction } from 'express';
import { Server } from 'socket.io';
import { createServer } from 'http';
import cors from 'cors';
import connectDB from './config/db';
import errorHandler from './middleware/errorHandler';
import mongoose from 'mongoose';

// Import routes
import userRoutes from './routes/userRoutes';
import categoryRoutes from './routes/categoryRoutes';

const app: Express = express();

// Connect to database with error handling
(async () => {
  try {
    await connectDB();
    console.log('Database connection established');
  } catch (error) {
    console.error('Failed to connect to database:', error);
    process.exit(1);
  }
})();

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);

// Root route
app.get('/', (req: Request, res: Response) => {
  res.send('Medico API is running...');
});

// Handle 404 routes
app.use((req: Request, res: Response) => {
  res.status(404).json({ message: 'Route not found' });
});

const PORT: number = parseInt(process.env.PORT || '5000', 10);

const httpServer = createServer(app);

// httpServer.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });

httpServer.listen(PORT, '192.168.1.4', () => {
  console.log(`Server running on http://192.168.1.4:${PORT}`);
});

// Handle process termination
process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close();
    console.log('MongoDB connection closed through app termination');
    process.exit(0);
  } catch (err) {
    console.error('Error during app termination:', err);
    process.exit(1);
  }
});
import dotenv from 'dotenv';
dotenv.config();

import { createServer } from 'http';
import mongoose from 'mongoose';
import app from './app';
import connectDB from './config/db';
import { logger } from './observability/logger';

// Import socket handlers
import { initializeSocket, getSocketIO } from './socket';
import { attachRedisAdapter, closeRedisAdapter } from './socket/redisAdapter';

const httpServer = createServer(app);

// Initialize socket handlers with httpServer
initializeSocket(httpServer);

const PORT: number = parseInt(process.env.PORT || '5000', 10);

const start = async () => {
  try {
    await connectDB();
    logger.info('Database connection established');
  } catch (error) {
    logger.error({ err: error }, 'Failed to connect to database');
    process.exit(1);
  }

  // With more than one replica, socket.io rooms must be shared through Redis,
  // otherwise a message sent on pod A never reaches a client connected to pod B.
  if (process.env.REDIS_URL) {
    await attachRedisAdapter(getSocketIO(), process.env.REDIS_URL);
  }

  // Bound to 0.0.0.0 → reachable on every interface (needed inside a container).
  httpServer.listen(PORT, '0.0.0.0', () => {
    logger.info({ port: PORT, version: process.env.APP_VERSION || 'dev' }, 'Server listening');
  });
};

start();

// Kubernetes stops a pod with SIGTERM (Ctrl+C locally sends SIGINT).
// Stop taking new connections, let in-flight requests finish, then close
// sockets, Redis and MongoDB. terminationGracePeriodSeconds in the chart
// is the hard limit.
let shuttingDown = false;
const shutdown = async (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Shutting down');

  const forceExit = setTimeout(() => {
    logger.error('Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, 25_000);
  forceExit.unref();

  try {
    getSocketIO().close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    await closeRedisAdapter();
    await mongoose.connection.close();
    logger.info('Shutdown complete');
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error during shutdown');
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

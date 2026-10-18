import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import errorHandler from './middleware/errorHandler';
import { httpLogger } from './observability/logger';
import { metricsMiddleware } from './observability/metrics';
import { requireFeature } from './middleware/featureFlag';

// Import routes
import opsRoutes from './routes/opsRoutes';
import userRoutes from './routes/userRoutes';
import categoryRoutes from './routes/categoryRoutes';
import medicineRoutes from './routes/medicineRoutes';
import storeRoutes from './routes/storeRoutes';
import cartRoutes from './routes/cartRoutes';
import searchRoutes from './routes/searchRoutes';
import chatRoutes from './routes/chatRoutes';
import storeMessageRoutes from './routes/storeMessageRoutes';
import orderRoutes from './routes/orderRoutes';
import prescriptionRoutes from './routes/prescriptionRoutes';
import verificationRoutes from './routes/verificationRoutes';

const app: Express = express();

// Health, readiness, version and /metrics come first so probes and scrapes
// are not logged or counted as user traffic.
app.use(opsRoutes);

app.use(httpLogger);
app.use(metricsMiddleware);

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '15mb' })); // base64 prescription images can be large
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Routes
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/medicines', medicineRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/store/messages', storeMessageRoutes);
app.use('/api/orders', orderRoutes);
// AI prescription reader depends on an external API, so it sits behind a flag
// that can be switched off from the ConfigMap without a new image.
app.use('/api/prescriptions', requireFeature('FEATURE_AI_PRESCRIPTIONS'), prescriptionRoutes);
app.use('/api/verifications', verificationRoutes);

// Root route
app.get('/', (req: Request, res: Response) => {
  res.send('Medico API is running...');
});

// Handle 404 routes
app.use((req: Request, res: Response) => {
  res.status(404).json({ message: 'Route not found' });
});

// Global error handler
app.use(errorHandler);

export default app;

import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { register } from '../observability/metrics';

const router = Router();

// Liveness: the process is up and the event loop answers. It does not check
// MongoDB, so a database outage does not make Kubernetes restart every pod.
router.get('/healthz', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

// Readiness: only receive traffic while connected to MongoDB.
router.get('/readyz', (req: Request, res: Response) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({ status: connected ? 'ready' : 'not ready' });
});

// Which build is running: the image tag and commit set by CI.
router.get('/version', (req: Request, res: Response) => {
  res.status(200).json({
    version: process.env.APP_VERSION || 'dev',
    commit: process.env.GIT_SHA || 'unknown',
  });
});

router.get('/metrics', async (req: Request, res: Response) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

export default router;

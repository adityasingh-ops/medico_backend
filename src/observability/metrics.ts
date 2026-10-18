import { Request, Response, NextFunction } from 'express';
import client from 'prom-client';

export const register = client.register;

// CPU, memory, event loop lag, GC, etc. for the Node process.
client.collectDefaultMetrics();

const httpRequests = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

const httpDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

export const socketConnections = new client.Gauge({
  name: 'socketio_connected_clients',
  help: 'Socket.io clients connected to this pod',
});

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const end = httpDuration.startTimer();
  res.on('finish', () => {
    // Use the route pattern (/api/orders/:id), not the raw URL, so every
    // order id does not become a new time series.
    const route = req.route ? req.baseUrl + req.route.path : 'unmatched';
    const labels = { method: req.method, route, status_code: String(res.statusCode) };
    httpRequests.inc(labels);
    end(labels);
  });
  next();
};

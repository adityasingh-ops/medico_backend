import pino from 'pino';
import pinoHttp from 'pino-http';

// JSON logs to stdout. Kubernetes keeps container stdout, and Alloy ships it
// to Loki, so the app never writes log files itself.
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: {
    service: 'medzo-api',
    version: process.env.APP_VERSION || 'dev',
  },
});

export const httpLogger = pinoHttp({
  logger,
  // Never write tokens to the logs.
  redact: ['req.headers.authorization', 'req.headers.cookie'],
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
});

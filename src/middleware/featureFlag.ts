import { Request, Response, NextFunction } from 'express';

// Flags are plain env vars from the ConfigMap. Anything other than "false"
// counts as on, so a missing value keeps the current behaviour.
export const isEnabled = (flag: string): boolean => process.env[flag] !== 'false';

export const requireFeature = (flag: string) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (!isEnabled(flag)) {
      res.status(503).json({ message: 'This feature is temporarily disabled' });
      return;
    }
    next();
  };

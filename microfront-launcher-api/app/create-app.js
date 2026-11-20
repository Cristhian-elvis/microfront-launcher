import express from 'express';

import { createErrorHandler } from './middlewares/error-handler.js';
import { createNotFoundHandler } from './middlewares/not-found.js';

export function createApp({ routers, enableJsonBody = true } = {}) {
  const app = express();
  app.disable('x-powered-by');

  if (enableJsonBody) {
    app.use(express.json({ limit: '1mb' }));
    app.use(express.urlencoded({ extended: false }));
  }

  // Routers
  for (const router of routers ?? []) {
    app.use('/api', router);
  }

  // Standard /api 404
  app.use('/api', createNotFoundHandler());

  // Standard error handler (must be last)
  app.use(createErrorHandler());

  return app;
}

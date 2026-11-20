import { Router } from 'express';

import { createComponentsController } from './controller.js';

export function createComponentsRouter() {
  const router = Router();

  const controller = createComponentsController();

  router.post('/components/start', controller.start);
  router.post('/components/stop', controller.stop);

  return router;
}

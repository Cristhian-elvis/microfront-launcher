import { Router } from 'express';

import { stateController } from './controller.js';

export function createStateRouter() {
  const router = Router();

  router.get('/bootstrap', stateController.getBootstrap);
  router.get('/state', stateController.getState);
  router.get('/config', stateController.getConfig);
  router.get('/setup', stateController.getSetupStatus);
  router.get('/logs', stateController.getLogs);
  router.get('/events', stateController.subscribeToEvents);

  return router;
}

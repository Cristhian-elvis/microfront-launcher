import { Router } from 'express';

import { environmentController } from './controller.js';

export function createEnvironmentRouter() {
  const router = Router();

  router.post('/environment/start', environmentController.startEnvironment);
  router.post('/shell/rebuild', environmentController.rebuildShell);
  router.post('/environment/cancel', environmentController.cancelEnvironment);
  router.post('/environment/stop', environmentController.stopEnvironment);

  return router;
}

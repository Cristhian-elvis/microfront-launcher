import { Router } from 'express';

import { launcherController } from './controller.js';

export function createLauncherRouter() {
  const router = Router();

  router.post('/launcher/check-updates', launcherController.checkUpdates);

  return router;
}

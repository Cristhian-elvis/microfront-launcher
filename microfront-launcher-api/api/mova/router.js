import { json, Router } from 'express';

import { movaController } from './controller.js';

export function createMovaRouter() {
  const router = Router();

  router.put('/mova/preferences', json(), movaController.updatePreferences);

  return router;
}

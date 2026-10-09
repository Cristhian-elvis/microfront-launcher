import { json, Router } from 'express';

import { browserController } from './controller.js';

export function createBrowserRouter() {
  const router = Router();
  const parseJson = json();

  router.post('/chrome/open', parseJson, browserController.openBrowser);
  router.post(
    '/chrome/open-professional',
    parseJson,
    browserController.openProfessionalBrowser,
  );
  router.post('/chrome/open-empty', browserController.openEmptyBrowser);

  return router;
}

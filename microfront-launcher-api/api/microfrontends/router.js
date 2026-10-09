import { json, Router } from 'express';

import { microfrontendsController } from './controller.js';

export function createMicrofrontendsRouter() {
  const router = Router();
  const parseJson = json();

  router.post(
    '/microfrontends/open',
    parseJson,
    microfrontendsController.openMicrofrontend,
  );
  router.post(
    '/microfrontends/open-folder',
    parseJson,
    microfrontendsController.openMicrofrontendFolder,
  );
  router.post(
    '/microfrontends/build',
    parseJson,
    microfrontendsController.buildMicrofrontend,
  );
  router.post(
    '/microfrontends/build-batch',
    parseJson,
    microfrontendsController.buildMicrofrontendBatch,
  );
  router.post(
    '/microfrontends/branch',
    parseJson,
    microfrontendsController.switchMicrofrontendBranch,
  );
  router.post(
    '/microfrontends/branch-batch',
    parseJson,
    microfrontendsController.switchMicrofrontendBranchBatch,
  );
  router.post(
    '/microfrontends/watch',
    parseJson,
    microfrontendsController.startMicrofrontendWatch,
  );
  router.post(
    '/microfrontends/watch/stop',
    parseJson,
    microfrontendsController.stopMicrofrontendWatch,
  );

  return router;
}

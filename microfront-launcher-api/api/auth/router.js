import { json, Router } from 'express';

import { authController } from './controller.js';

export function createAuthRouter() {
  const router = Router();
  const parseJson = json();

  router.get('/auth/user-profiles', authController.listProfiles);
  router.post('/auth/user-profiles', parseJson, authController.createProfile);
  router.put('/auth/user-profiles/:id', parseJson, authController.updateProfile);
  router.delete('/auth/user-profiles/:id', authController.removeProfile);
  router.post('/auth/token', parseJson, authController.createToken);
  router.get('/auth/tokens', authController.listTokens);
  router.delete('/auth/tokens/:id', authController.removeToken);

  return router;
}

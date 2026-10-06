import { json, Router } from 'express';
import { writePreferences } from '../../lib/core.js';
import { RuntimeStateService } from "./../../services/runtime-state-service.js";

export function createMovaRouter() {
  const router = Router();

  router.put('/mova/preferences', json(), (request, response) => {
    const preferences = { ...request.body };
    delete preferences.componentsVersion;
    delete preferences.preferredTag;
    writePreferences(preferences);
    RuntimeStateService.emitPreferences();
    response.json({ message: 'Preferencias guardadas.' });
  });

  return router;
}

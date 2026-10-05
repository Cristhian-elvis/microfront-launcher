import { json, Router } from 'express';
import { writePreferences } from '../../lib/core.js';

export function createMovaRouter({ emitPreferences }) {
  const router = Router();

  router.put('/mova/preferences', json(), (request, response) => {
    const preferences = { ...request.body };
    delete preferences.componentsVersion;
    delete preferences.preferredTag;
    writePreferences(preferences);
    emitPreferences();
    response.json({ message: 'Preferencias guardadas.' });
  });

  return router;
}

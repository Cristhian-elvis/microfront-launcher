import { writePreferences } from '../../lib/core.js';
import { RuntimeStateService } from '../../services/runtime-state-service.js';

function updatePreferences(request, response) {
  const preferences = { ...request.body };

  delete preferences.componentsVersion;
  delete preferences.preferredTag;
  delete preferences.avatarLetters;

  writePreferences(preferences);
  RuntimeStateService.emitPreferences();

  response.json({ message: 'Preferencias guardadas.' });
}

export const movaController = {
  updatePreferences,
};

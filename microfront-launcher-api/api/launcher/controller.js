import { checkLauncherUpdates } from '../../lib/core.js';

async function checkUpdates(request, response) {
  response.json(await checkLauncherUpdates());
}

export const launcherController = {
  checkUpdates,
};

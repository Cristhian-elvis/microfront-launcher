import {
  getProjects,
  needsInitialSetup,
  readConfig,
  readPreferences,
} from '../../lib/core.js';
import { eventClients, logs } from '../../lib/runtime-events.js';
import { latestVersion } from '../../services/components-version-service.js';
import { RuntimeStateService } from '../../services/runtime-state-service.js';

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

async function getBootstrap(request, response) {
  if (needsInitialSetup()) {
    response.json({ setup: { required: true } });
    return;
  }

  const [projects] = await Promise.allSettled([getProjects()]);
  let latestComponentsVersion = null;
  let latestVersionError = null;

  try {
    latestComponentsVersion = await latestVersion();
  } catch (error) {
    latestVersionError = errorMessage(error);
  }

  response.json({
    runtime: RuntimeStateService.getRuntime(),
    preferences: readPreferences(),
    projects: projects.status === 'fulfilled' ? projects.value : [],
    latestVersion: latestComponentsVersion,
    logs: logs.slice(-500),
    setup: { required: needsInitialSetup() },
    errors: {
      ...(projects.status === 'rejected'
        ? { projects: errorMessage(projects.reason) }
        : {}),
      ...(latestVersionError ? { latestVersion: latestVersionError } : {}),
    },
  });
}

function getState(request, response) {
  response.json(RuntimeStateService.getRuntime());
}

function getConfig(request, response) {
  response.json(readConfig());
}

function getSetupStatus(request, response) {
  response.json({ required: needsInitialSetup() });
}

function getLogs(request, response) {
  response.json(logs.slice(-500));
}

function subscribeToEvents(request, response) {
  response.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  response.write(': connected\n\n');

  eventClients.add(response);
  request.on('close', () => eventClients.delete(response));
}

export const stateController = {
  getBootstrap,
  getConfig,
  getLogs,
  getSetupStatus,
  getState,
  subscribeToEvents,
};
